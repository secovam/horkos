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

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const DOCUMENT_ACCEPT = "application/pdf";

// Deterministic, so a retried submit overwrites instead of orphaning. The bucket also
// holds HR uploads later, under `invitations/{id}/hr/`.
export function employeeObjectKey(invitationId: string, kind: DocumentKind) {
  return `invitations/${invitationId}/employee/${kind}`;
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
});

export type SubmissionInput = z.input<typeof submissionSchema>;

export type SubmissionFields = z.output<typeof submissionSchema>;
