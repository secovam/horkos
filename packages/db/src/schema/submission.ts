import { defineRelationsPart, sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { invitation } from "./invitation";

export const DOCUMENT_KIND_VALUES = [
  "tax_status",
  "imss",
  "proof_of_address",
] as const;

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const submission = sqliteTable("submission", {
  invitationId: text("invitation_id")
    .primaryKey()
    .references(() => invitation.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  rfc: text("rfc").notNull(),
  curp: text("curp").notNull(),
  nss: text("nss").notNull(),
  street: text("street").notNull(),
  extNumber: text("ext_number").notNull(),
  intNumber: text("int_number"),
  suburb: text("suburb").notNull(),
  postalCode: text("postal_code").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(now)
    .notNull(),
});

export const document = sqliteTable(
  "document",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    invitationId: text("invitation_id")
      .notNull()
      .references(() => invitation.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: DOCUMENT_KIND_VALUES }).notNull(),
    objectKey: text("object_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    uploadedAt: integer("uploaded_at", { mode: "timestamp_ms" })
      .default(now)
      .notNull(),
  },
  (table) => [
    uniqueIndex("document_invitation_kind_idx").on(
      table.invitationId,
      table.kind
    ),
  ]
);

export const EXTRACTION_STATUS_VALUES = [
  "extracted",
  "unreadable",
  "failed",
] as const;

// What Horkos read from a document, kept apart from `submission` so HR can compare the two.
// `failed` means the extractor errored, `unreadable` means it ran but found no text.
export const extraction = sqliteTable(
  "extraction",
  {
    invitationId: text("invitation_id")
      .notNull()
      .references(() => invitation.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: DOCUMENT_KIND_VALUES }).notNull(),
    status: text("status", { enum: EXTRACTION_STATUS_VALUES }).notNull(),
    fields: text("fields", { mode: "json" })
      .$type<Record<string, string>>()
      .notNull(),
    warnings: text("warnings", { mode: "json" }).$type<string[]>().notNull(),
    extractedAt: integer("extracted_at", { mode: "timestamp_ms" })
      .default(now)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.invitationId, table.kind] })]
);

export const submissionRelations = defineRelationsPart(
  { invitation, submission, document, extraction },
  (r) => ({
    submission: {
      invitation: r.one.invitation({
        from: r.submission.invitationId,
        to: r.invitation.id,
      }),
    },
    document: {
      invitation: r.one.invitation({
        from: r.document.invitationId,
        to: r.invitation.id,
      }),
    },
    extraction: {
      invitation: r.one.invitation({
        from: r.extraction.invitationId,
        to: r.invitation.id,
      }),
    },
    invitation: {
      submission: r.one.submission({
        from: r.invitation.id,
        to: r.submission.invitationId,
      }),
      documents: r.many.document({
        from: r.invitation.id,
        to: r.document.invitationId,
      }),
      extractions: r.many.extraction({
        from: r.invitation.id,
        to: r.extraction.invitationId,
      }),
    },
  })
);
