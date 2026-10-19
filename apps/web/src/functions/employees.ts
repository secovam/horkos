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
  employeeIdSchema,
  listEmployeesSchema,
  reviewSubmission,
  toFormValues,
} from "@/lib/employee-record";
import { employmentDefaults, employmentSchema } from "@/lib/employment";
import { POSTAL_CODE_REGEX, applyPostalCode } from "@/lib/postal-code";
import { submissionSchema } from "@/lib/submission";
import { requireSessionMiddleware } from "@/middleware/auth";
import { getDb } from "@/services";
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
          extractions.filter(({ invitationId }) => invitationId === employee.id)
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

    return {
      employee,
      values: toFormValues(submitted),
      employmentValues: employmentDefaults(savedEmployment ?? null, {
        invitationEmail: employee.email,
        curp: submitted.curp,
      }),
      employmentComplete: savedEmployment !== undefined,
      documents,
      extractions: extractions.map(({ kind, status, warnings }) => ({
        kind,
        status,
        warnings,
      })),
      review: reviewSubmission(submitted, extractions),
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

const EMPLOYMENT_REQUIRED = "Completa los datos laborales antes de confirmar.";

const saveEmploymentSchema = employeeIdSchema.extend({
  fields: employmentSchema,
});

export const saveEmployment = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(saveEmploymentSchema)
  .handler(async ({ data: { invitationId, fields } }) => {
    const stored = { ...fields, manager: fields.manager || null };

    // The insert reads from the guarded invitation row, so a confirmation that lands meanwhile writes nothing.
    const saved = await getDb()
      .insert(employment)
      .select(
        getDb()
          .select({
            invitationId: invitation.id,
            workEmail: sql<string>`${stored.workEmail}`.as("work_email"),
            personalEmail: sql<string>`${stored.personalEmail}`.as(
              "personal_email"
            ),
            jobTitle: sql<string>`${stored.jobTitle}`.as("job_title"),
            department: sql<string>`${stored.department}`.as("department"),
            manager: sql<string | null>`${stored.manager}`.as("manager"),
            office: sql<string>`${stored.office}`.as("office"),
            companies: sql<string>`${JSON.stringify(stored.companies)}`.as(
              "companies"
            ),
            nationality: sql<string>`${stored.nationality}`.as("nationality"),
            sex: sql<string>`${stored.sex}`.as("sex"),
            hireDate: sql<string>`${stored.hireDate}`.as("hire_date"),
            updatedAt: sql<number>`${Date.now()}`.as("updated_at"),
          })
          .from(invitation)
          .where(
            and(
              eq(invitation.id, invitationId),
              SUBMITTED_AND_ACTIVE,
              isNull(invitation.hrCompletedAt)
            )
          )
      )
      .onConflictDoUpdate({
        target: employment.invitationId,
        set: { ...stored, updatedAt: new Date() },
      })
      .returning({ invitationId: employment.invitationId });

    if (saved.length === 0) {
      throw new Error(UNAVAILABLE_RECORD);
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
