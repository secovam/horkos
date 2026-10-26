import { invitation } from "@horkos/db/schema/invitation";
import { registration } from "@horkos/db/schema/registration";
import { createServerFn } from "@tanstack/react-start";
import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { ENV } from "@/env.server";
import { PublicError } from "@/lib/public-error";
import {
  REGISTRATIONS_PAGE_SIZE,
  listRegistrationsSchema,
  publicRegistrationSchema,
  updateRegistrationSchema,
} from "@/lib/registration";
import { requireSessionMiddleware } from "@/middleware/auth";
import { getDb } from "@/services";
import { searchFilter } from "@/services/invitation-search";
import { verifyTurnstile } from "@/services/turnstile";

// Public: the site key is meant to be seen by the browser.
export const getTurnstileSiteKey = createServerFn({ method: "GET" }).handler(
  () => ({ siteKey: ENV.TURNSTILE_SITE_KEY })
);

// Public. A repeated email gets the same answer as a new one, so nobody can learn who registered.
export const register = createServerFn({ method: "POST" })
  .validator(publicRegistrationSchema)
  .handler(async ({ data: { turnstileToken, ...data } }) => {
    if (!(await verifyTurnstile(turnstileToken))) {
      throw new PublicError(
        "No pudimos verificar que no eres un robot. Intenta de nuevo."
      );
    }

    await getDb().insert(registration).values(data).onConflictDoNothing();
  });

// POST keeps search terms and employee data out of request URLs and logs.
export const listRegistrations = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(listRegistrationsSchema)
  .handler(async ({ data: { q, page } }) => {
    const db = getDb();
    const search = searchFilter(q, registration);

    const [rows, [{ total }], [{ pending }]] = await Promise.all([
      db
        .select({
          id: registration.id,
          employeeName: registration.employeeName,
          email: registration.email,
          createdAt: registration.createdAt,
        })
        .from(registration)
        .where(search)
        .orderBy(desc(registration.createdAt))
        .limit(REGISTRATIONS_PAGE_SIZE)
        .offset((page - 1) * REGISTRATIONS_PAGE_SIZE),
      db.select({ total: count() }).from(registration).where(search),
      db.select({ pending: count() }).from(registration),
    ]);

    return { rows, total, pending };
  });

export const updateRegistration = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(updateRegistrationSchema)
  .handler(async ({ data: { id, ...data } }) => {
    const db = getDb();

    const taken = await db
      .select({ id: registration.id })
      .from(registration)
      .where(and(eq(registration.email, data.email), ne(registration.id, id)));

    if (taken.length > 0) {
      throw new PublicError("Ya hay otro registro con este correo.");
    }

    const [updated] = await db
      .update(registration)
      .set(data)
      .where(eq(registration.id, id))
      .returning({ id: registration.id });

    if (!updated) {
      throw new PublicError("El registro ya no existe.");
    }
  });

const registrationIdSchema = z.object({ id: z.string().min(1) });

export const deleteRegistration = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .validator(registrationIdSchema)
  .handler(async ({ data }) => {
    const [deleted] = await getDb()
      .delete(registration)
      .where(eq(registration.id, data.id))
      .returning({ id: registration.id });

    if (!deleted) {
      throw new PublicError("El registro ya no existe.");
    }
  });

// Queued rows are the same as a CSV load, so the cron sends them. Emails that already have an
// invitation are skipped. Both statements run in one D1 transaction, so a registration arriving
// meanwhile is either invited and deleted, or left for next time.
export const inviteAllRegistrations = createServerFn({ method: "POST" })
  .middleware([requireSessionMiddleware])
  .handler(async ({ context }) => {
    const db = getDb();

    const [invited, processed] = await db.batch([
      db
        .insert(invitation)
        .select(
          db
            .select({
              id: sql<string>`lower(hex(randomblob(16)))`.as("id"),
              employeeName: registration.employeeName,
              email: registration.email,
              createdBy: sql<string>`${context.session.user.id}`.as(
                "created_by"
              ),
            })
            .from(registration)
            // SQLite needs a WHERE before ON CONFLICT in INSERT ... SELECT to parse it.
            .where(sql`true`)
        )
        .onConflictDoNothing()
        .returning({ id: invitation.id }),
      db.delete(registration).returning({ id: registration.id }),
    ]);

    return {
      invited: invited.length,
      skipped: processed.length - invited.length,
    };
  });
