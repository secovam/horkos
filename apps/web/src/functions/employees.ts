import { invitation } from "@horkos/db/schema/invitation";
import { document, extraction, submission } from "@horkos/db/schema/submission";
import { createServerFn } from "@tanstack/react-start";
import { and, count, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import {
  EMPLOYEES_PAGE_SIZE,
  employeeIdSchema,
  listEmployeesSchema,
  reviewSubmission,
} from "@/lib/employee-record";
import { requireSessionMiddleware } from "@/middleware/auth";
import { getDb } from "@/services";
import { searchFilter } from "@/services/invitation-search";

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
        submitted: submission,
      })
      .from(invitation)
      .innerJoin(submission, eq(submission.invitationId, invitation.id))
      .where(and(eq(invitation.id, invitationId), SUBMITTED_AND_ACTIVE));

    if (!found) {
      return null;
    }

    const [documents, extractions] = await Promise.all([
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
    ]);

    const { submitted, ...employee } = found;

    return {
      employee,
      documents,
      extractions: extractions.map(({ kind, status, warnings }) => ({
        kind,
        status,
        warnings,
      })),
      review: reviewSubmission(submitted, extractions),
    };
  });
