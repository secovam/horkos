import { employment } from "@horkos/db/schema/employment";
import { invitation } from "@horkos/db/schema/invitation";
import { document, extraction, submission } from "@horkos/db/schema/submission";
import { createServerFn } from "@tanstack/react-start";
import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import {
  EMPLOYEES_PAGE_SIZE,
  employeeExtractions,
  employeeIdSchema,
  listEmployeesSchema,
  reviewSubmission,
  toFormValues,
} from "@/lib/employee-record";
import { employmentDefaults, employmentSchema } from "@/lib/employment";
import { POSTAL_CODE_REGEX, applyPostalCode } from "@/lib/postal-code";
import {
  hrObjectKey,
  parseDocumentFile,
  submissionSchema,
} from "@/lib/submission";
import { requireSessionMiddleware } from "@/middleware/auth";
import { getDb } from "@/services";
import { storeDocument } from "@/services/document-storage";
import { extractImssRegistration } from "@/services/extractor";
import { searchFilter } from "@/services/invitation-search";
import { lookupPostalCode } from "@/services/sepomex";

const SUBMITTED_AND_ACTIVE = and(
  isNotNull(invitation.submittedAt),
  isNull(invitation.revokedAt)
);

// POST keeps search terms and employee data out of request URLs and logs.
export const listEmployees = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(listEmployeesSchema)
  .handler(async ({ data: { q, page } }) => {
    const db = getDb();
    const where = and(SUBMITTED_AND_ACTIVE, searchFilter(q));

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: invitation.id,
          employeeName: invitation.employeeName,
          email: invitation.email,
          submittedAt: invitation.submittedAt,
          hrCompletedAt: invitation.hrCompletedAt,
          submitted: submission,
        })
        .from(invitation)
        .innerJoin(submission, eq(submission.invitationId, invitation.id))
        .where(where)
        .orderBy(desc(invitation.submittedAt))
        .limit(EMPLOYEES_PAGE_SIZE)
        .offset((page - 1) * EMPLOYEES_PAGE_SIZE),
      db.select({ total: count() }).from(invitation).where(where),
    ]);

    const extractions = rows.length
      ? await db
          .select({
            invitationId: extraction.invitationId,
            kind: extraction.kind,
            status: extraction.status,
            fields: extraction.fields,
            warnings: extraction.warnings,
          })
          .from(extraction)
          .where(
            inArray(
              extraction.invitationId,
              rows.map(({ id }) => id)
            )
          )
      : [];

    return {
      total,
      rows: rows.map(({ submitted, ...employee }) => ({
        ...employee,
        needsAttention: reviewSubmission(
          submitted,
          employeeExtractions(
            extractions.filter(
              ({ invitationId }) => invitationId === employee.id
            )
          )
        ).needsAttention,
      })),
    };
  });

export const getEmployee = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(employeeIdSchema)
  .handler(async ({ data: { invitationId } }) => {
    const db = getDb();

    const [found] = await db
      .select({
        employeeName: invitation.employeeName,
        email: invitation.email,
        submittedAt: invitation.submittedAt,
        hrCompletedAt: invitation.hrCompletedAt,
        submitted: submission,
      })
      .from(invitation)
      .innerJoin(submission, eq(submission.invitationId, invitation.id))
      .where(and(eq(invitation.id, invitationId), SUBMITTED_AND_ACTIVE));

    if (!found) {
      return null;
    }

    const [documents, extractions, [savedEmployment]] = await Promise.all([
      db
        .select({
          kind: document.kind,
          fileName: document.fileName,
          size: document.size,
          uploadedAt: document.uploadedAt,
        })
        .from(document)
        .where(eq(document.invitationId, invitationId)),
      db
        .select({
          kind: extraction.kind,
          status: extraction.status,
          fields: extraction.fields,
          warnings: extraction.warnings,
        })
        .from(extraction)
        .where(eq(extraction.invitationId, invitationId)),
      db
        .select()
        .from(employment)
        .where(eq(employment.invitationId, invitationId)),
    ]);

    const { submitted, ...employee } = found;

    const imssFile = documents.find(({ kind }) => kind === "imss_registration");

    const imssExtraction = extractions.find(
      ({ kind }) => kind === "imss_registration"
    );

    const imssProposals = {
      dailySalary: imssExtraction?.fields.dailySalary,
      hireDate: imssExtraction?.fields.hireDate,
    };

    return {
      employee,
      values: toFormValues(submitted),
      employmentValues: employmentDefaults(savedEmployment ?? null, {
        invitationEmail: employee.email,
        curp: submitted.curp,
        proposals: imssProposals,
      }),
      imssRegistration: imssFile
        ? {
            fileName: imssFile.fileName,
            uploadedAt: imssFile.uploadedAt,
            status: imssExtraction?.status ?? "failed",
            proposals: imssProposals,
          }
        : null,
      employmentComplete: savedEmployment !== undefined,
      documents,
      extractions: extractions.map(({ kind, status, warnings }) => ({
        kind,
        status,
        warnings,
      })),
      review: reviewSubmission(submitted, employeeExtractions(extractions)),
    };
  });

export const findEmployeePostalCode = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(z.object({ postalCode: z.string().regex(POSTAL_CODE_REGEX) }))
  .handler(({ data }) => lookupPostalCode(data.postalCode));

const UNAVAILABLE_RECORD =
  "Este expediente ya fue confirmado o ya no está disponible.";

const CANNOT_REOPEN = "Este expediente no se puede reabrir.";

const updateEmployeeSchema = employeeIdSchema.extend({
  fields: submissionSchema,
});

export const updateEmployee = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(updateEmployeeSchema)
  .handler(async ({ data: { invitationId, fields: typed } }) => {
    const checked = applyPostalCode(
      typed,
      await lookupPostalCode(typed.postalCode)
    );

    if (!checked.ok) {
      throw new Error(checked.message);
    }

    const { fields } = checked;
    const db = getDb();

    // One statement, so a confirmation that lands meanwhile leaves the data untouched.
    const updated = await db
      .update(submission)
      .set({ ...fields, intNumber: fields.intNumber || null })
      .where(
        and(
          eq(submission.invitationId, invitationId),
          inArray(
            submission.invitationId,
            db
              .select({ id: invitation.id })
              .from(invitation)
              .where(
                and(
                  eq(invitation.id, invitationId),
                  SUBMITTED_AND_ACTIVE,
                  isNull(invitation.hrCompletedAt)
                )
              )
          )
        )
      )
      .returning({ invitationId: submission.invitationId });

    if (updated.length === 0) {
      throw new Error(UNAVAILABLE_RECORD);
    }

    return { ok: true };
  });

const IMSS_REGISTRATION_REQUIRED =
  "Sube el alta del IMSS antes de guardar los datos laborales.";

function openRecord(invitationId: string) {
  return and(
    eq(invitation.id, invitationId),
    SUBMITTED_AND_ACTIVE,
    isNull(invitation.hrCompletedAt)
  );
}

function parseImssRegistrationForm(form: FormData) {
  const ids = employeeIdSchema.safeParse({
    invitationId: form.get("invitationId"),
  });

  if (!ids.success) {
    throw new Error("Revisa los datos e inténtalo de nuevo.");
  }

  return {
    invitationId: ids.data.invitationId,
    file: parseDocumentFile(form.get("file")),
  };
}

// HR uploads it because the employee never has it. Uploading again replaces it.
export const uploadImssRegistration = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(parseImssRegistrationForm)
  .handler(async ({ data: { invitationId, file } }) => {
    const db = getDb();

    const [[open], bytes] = await Promise.all([
      db
        .select({ id: invitation.id })
        .from(invitation)
        .where(openRecord(invitationId)),
      file.arrayBuffer(),
    ]);

    if (!open) {
      throw new Error(UNAVAILABLE_RECORD);
    }

    const result = await storeDocument({
      invitationId,
      kind: "imss_registration",
      objectKey: hrObjectKey(
        invitationId,
        "imss_registration",
        crypto.randomUUID()
      ),
      file,
      bytes,
      read: extractImssRegistration,
    });

    return { fileName: file.name, extraction: result };
  });

const EMPLOYMENT_REQUIRED = "Completa los datos laborales antes de confirmar.";

const saveEmploymentSchema = employeeIdSchema.extend({
  fields: employmentSchema,
});

export const saveEmployment = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(saveEmploymentSchema)
  .handler(async ({ data: { invitationId, fields } }) => {
    const { dailySalary: dailySalaryCents, ...rest } = fields;

    const stored = {
      ...rest,
      dailySalaryCents,
      workEmail: fields.workEmail || null,
    };

    const db = getDb();

    // The insert reads from the guarded invitation row, so a confirmation that lands meanwhile writes nothing.
    // It also needs the alta del IMSS on file, so the salary always has a document behind it.
    const saved = await db
      .insert(employment)
      .select(
        db
          .select({
            invitationId: invitation.id,
            workEmail: sql<string | null>`${stored.workEmail}`.as("work_email"),
            personalEmail: sql<string>`${stored.personalEmail}`.as(
              "personal_email"
            ),
            jobTitle: sql<string>`${stored.jobTitle}`.as("job_title"),
            department: sql<string>`${stored.department}`.as("department"),
            company: sql<string>`${stored.company}`.as("company"),
            nationality: sql<string>`${stored.nationality}`.as("nationality"),
            sex: sql<string>`${stored.sex}`.as("sex"),
            hireDate: sql<string>`${stored.hireDate}`.as("hire_date"),
            dailySalaryCents: sql<number>`${stored.dailySalaryCents}`.as(
              "daily_salary_cents"
            ),
            updatedAt: sql<number>`${Date.now()}`.as("updated_at"),
          })
          .from(invitation)
          .where(
            and(
              openRecord(invitationId),
              inArray(
                invitation.id,
                db
                  .select({ id: document.invitationId })
                  .from(document)
                  .where(
                    and(
                      eq(document.invitationId, invitationId),
                      eq(document.kind, "imss_registration")
                    )
                  )
              )
            )
          )
      )
      .onConflictDoUpdate({
        target: employment.invitationId,
        set: { ...stored, updatedAt: new Date() },
      })
      .returning({ invitationId: employment.invitationId });

    if (saved.length === 0) {
      const [stillOpen] = await db
        .select({ id: invitation.id })
        .from(invitation)
        .where(openRecord(invitationId));

      throw new Error(
        stillOpen ? IMSS_REGISTRATION_REQUIRED : UNAVAILABLE_RECORD
      );
    }

    return { ok: true };
  });

export const confirmEmployee = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(employeeIdSchema)
  .handler(async ({ data: { invitationId } }) => {
    const db = getDb();

    const open = and(
      eq(invitation.id, invitationId),
      SUBMITTED_AND_ACTIVE,
      isNull(invitation.hrCompletedAt)
    );

    const updated = await db
      .update(invitation)
      .set({ hrCompletedAt: new Date() })
      .where(
        and(
          open,
          inArray(
            invitation.id,
            db.select({ id: employment.invitationId }).from(employment)
          )
        )
      )
      .returning({ id: invitation.id });

    if (updated.length === 0) {
      const [stillOpen] = await db
        .select({ id: invitation.id })
        .from(invitation)
        .where(open);

      throw new Error(stillOpen ? EMPLOYMENT_REQUIRED : UNAVAILABLE_RECORD);
    }

    return { ok: true };
  });

export const reopenEmployee = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(employeeIdSchema)
  .handler(async ({ data: { invitationId } }) => {
    const updated = await getDb()
      .update(invitation)
      .set({ hrCompletedAt: null })
      .where(
        and(
          eq(invitation.id, invitationId),
          SUBMITTED_AND_ACTIVE,
          isNotNull(invitation.hrCompletedAt),
          isNull(invitation.contractGeneratedAt)
        )
      )
      .returning({ id: invitation.id });

    if (updated.length === 0) {
      throw new Error(CANNOT_REOPEN);
    }

    return { ok: true };
  });
