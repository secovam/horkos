import { z } from "zod";

export const DOCUMENT_KIND_LIST = [
  "tax_status",
  "imss",
  "proof_of_address",
] as const;

export type DocumentKind = (typeof DOCUMENT_KIND_LIST)[number];

export const DOCUMENT_KINDS = {
  tax_status: { label: "Constancia de situación fiscal" },
  imss: { label: "Constancia del IMSS (NSS)" },
  proof_of_address: { label: "Comprobante de domicilio (Telmex o CFE)" },
} satisfies Record<DocumentKind, { label: string }>;

// Documents HR uploads for an employee, who never sees them.
export const HR_DOCUMENT_KIND_LIST = ["imss_registration"] as const;

export type HrDocumentKind = (typeof HR_DOCUMENT_KIND_LIST)[number];

export const HR_DOCUMENT_KINDS = {
  imss_registration: { label: "Alta del IMSS" },
} satisfies Record<HrDocumentKind, { label: string }>;

export const STORED_DOCUMENT_KIND_LIST = [
  ...DOCUMENT_KIND_LIST,
  ...HR_DOCUMENT_KIND_LIST,
] as const;

export type StoredDocumentKind = (typeof STORED_DOCUMENT_KIND_LIST)[number];

export const STORED_DOCUMENT_KINDS = {
  ...DOCUMENT_KINDS,
  ...HR_DOCUMENT_KINDS,
} satisfies Record<StoredDocumentKind, { label: string }>;

export function isEmployeeDocumentKind(
  kind: StoredDocumentKind
): kind is DocumentKind {
  return DOCUMENT_KIND_LIST.some((item) => item === kind);
}

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const DOCUMENT_ACCEPT = "application/pdf";

// One key per upload, so concurrent replacements never share bytes. HR uploads live
// apart, under `invitations/{id}/hr/`.
export function employeeObjectKey(
  invitationId: string,
  kind: DocumentKind,
  uploadId: string
) {
  return `invitations/${invitationId}/employee/${kind}/${uploadId}`;
}

export function hrObjectKey(
  invitationId: string,
  kind: HrDocumentKind,
  uploadId: string
) {
  return `invitations/${invitationId}/hr/${kind}/${uploadId}`;
}

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46] as const;

// The client-declared content type is untrusted, so the type comes from the file's first bytes.
export function detectDocumentType(bytes: Uint8Array) {
  const isPdf =
    bytes.length >= PDF_SIGNATURE.length &&
    PDF_SIGNATURE.every((byte, index) => bytes[index] === byte);

  return isPdf ? "application/pdf" : null;
}

export const documentFileSchema = z
  .instanceof(File, { error: "Sube este documento." })
  .refine((file) => file.size > 0, "El archivo está vacío.")
  .refine(
    (file) => file.size <= MAX_DOCUMENT_BYTES,
    "El archivo pesa más de 10 MB."
  );

export function parseDocumentFile(value: FormDataEntryValue | null) {
  const file = documentFileSchema.safeParse(value);

  if (!file.success) {
    throw new Error(file.error.issues[0].message);
  }

  return file.data;
}

export const MARITAL_STATUS_LIST = ["single", "married", "common_law"] as const;

export type MaritalStatus = (typeof MARITAL_STATUS_LIST)[number];

export const MARITAL_STATUSES = {
  single: { label: "Soltero/a" },
  married: { label: "Casado/a" },
  common_law: { label: "Unión libre" },
} satisfies Record<MaritalStatus, { label: string }>;

export const RELATIONSHIP_LIST = [
  "parent",
  "sibling",
  "spouse",
  "child",
] as const;

export type Relationship = (typeof RELATIONSHIP_LIST)[number];

export const RELATIONSHIPS = {
  parent: { label: "Padre/Madre" },
  sibling: { label: "Hermano/a" },
  spouse: { label: "Cónyuge" },
  child: { label: "Hijo/a" },
} satisfies Record<Relationship, { label: string }>;

// A string first, so the form can start with nothing chosen.
function choice<const T extends readonly [string, ...string[]]>(
  values: T,
  error: string
) {
  return z.string({ error }).pipe(z.enum(values, { error }));
}

function required(label: string) {
  return z
    .string()
    .trim()
    .min(1, `Escribe ${label}.`)
    .max(200, "Es demasiado largo.");
}

export const submissionSchema = z.object({
  fullName: required("tu nombre completo"),
  rfc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-ZÑ&]{4}\d{6}[A-Z\d]{3}$/u,
      "Escribe un RFC válido de 13 caracteres."
    ),
  curp: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/u,
      "Escribe una CURP válida de 18 caracteres."
    ),
  nss: z
    .string()
    .trim()
    .regex(/^\d{11}$/u, "El NSS tiene 11 dígitos."),
  maritalStatus: choice(MARITAL_STATUS_LIST, "Elige tu estado civil."),
  // Spaces, dashes and parentheses are how people write a number, so only the digits count.
  phone: z
    .string()
    .transform((value) => value.replaceAll(/[\s()-]/gu, ""))
    .pipe(z.string().regex(/^\d{10}$/u, "El teléfono tiene 10 dígitos.")),
  street: required("tu calle"),
  extNumber: required("tu número exterior"),
  intNumber: z.string().trim().max(50, "Es demasiado largo."),
  suburb: required("tu colonia"),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/u, "El código postal tiene 5 dígitos."),
  city: required("tu municipio"),
  state: required("tu estado"),
  beneficiaryName: required("el nombre de tu beneficiario"),
  beneficiaryRelationship: choice(
    RELATIONSHIP_LIST,
    "Elige el parentesco con tu beneficiario."
  ),
});

export type SubmissionInput = z.input<typeof submissionSchema>;

export type SubmissionFields = z.output<typeof submissionSchema>;

export const SUBMISSION_SECTIONS = {
  personal: "Datos personales",
  address: "Domicilio",
  beneficiary: "Beneficiario",
} as const;

export type SubmissionSection = keyof typeof SUBMISSION_SECTIONS;

export const SUBMISSION_FIELDS = {
  fullName: { label: "Nombre completo", section: "personal" },
  rfc: { label: "RFC", section: "personal" },
  curp: { label: "CURP", section: "personal" },
  nss: { label: "Número de seguridad social (NSS)", section: "personal" },
  maritalStatus: { label: "Estado civil", section: "personal" },
  phone: { label: "Teléfono", section: "personal" },
  street: { label: "Calle", section: "address" },
  extNumber: { label: "Número exterior", section: "address" },
  intNumber: { label: "Número interior (opcional)", section: "address" },
  postalCode: { label: "Código postal", section: "address" },
  suburb: { label: "Colonia", section: "address" },
  city: { label: "Municipio o alcaldía", section: "address" },
  state: { label: "Estado", section: "address" },
  beneficiaryName: { label: "Nombre del beneficiario", section: "beneficiary" },
  beneficiaryRelationship: { label: "Parentesco", section: "beneficiary" },
} satisfies Record<
  keyof SubmissionFields,
  { label: string; section: SubmissionSection }
>;
