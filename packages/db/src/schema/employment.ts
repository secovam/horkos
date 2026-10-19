import { defineRelationsPart, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { invitation } from "./invitation";

export const OFFICE_VALUES = [
  "Acapulco",
  "Cancún",
  "CDMX",
  "Guadalajara",
  "Guanajuato",
  "Matriz",
  "Monterrey",
  "Pachuca",
  "Querétaro",
  "San Luis",
  "Tijuana",
] as const;

export const DEPARTMENT_VALUES = [
  "Administración",
  "Calidad",
  "Departamento Técnico",
  "Gestión y Estudios Especiales",
  "Jurídico",
  "Laboratorio",
  "Marca y Desarrollo Humano",
  "Recursos Humanos",
  "Ventas",
  "Unidad de Inspección",
] as const;

export const SEX_VALUES = ["male", "female"] as const;

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

// What HR fills in, kept apart from `submission`, which is what the employee sent.
export const employment = sqliteTable("employment", {
  invitationId: text("invitation_id")
    .primaryKey()
    .references(() => invitation.id, { onDelete: "cascade" }),
  workEmail: text("work_email").notNull(),
  personalEmail: text("personal_email").notNull(),
  jobTitle: text("job_title").notNull(),
  department: text("department", { enum: DEPARTMENT_VALUES }).notNull(),
  manager: text("manager"),
  office: text("office", { enum: OFFICE_VALUES }).notNull(),
  companies: text("companies", { mode: "json" }).$type<string[]>().notNull(),
  nationality: text("nationality").notNull(),
  sex: text("sex", { enum: SEX_VALUES }).notNull(),
  hireDate: text("hire_date").notNull(),
  dailySalaryCents: integer("daily_salary_cents").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(now)
    .notNull(),
});

export const employmentRelations = defineRelationsPart(
  { invitation, employment },
  (r) => ({
    employment: {
      invitation: r.one.invitation({
        from: r.employment.invitationId,
        to: r.invitation.id,
      }),
    },
    invitation: {
      employment: r.one.employment({
        from: r.invitation.id,
        to: r.employment.invitationId,
      }),
    },
  })
);
