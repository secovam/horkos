import { z } from "zod";

import { EXTRACTION_WARNINGS } from "./extraction";
import type { ExtractionStatus, ExtractionWarning } from "./extraction";
import {
  DOCUMENT_KIND_LIST,
  MARITAL_STATUSES,
  MARITAL_STATUS_LIST,
  RELATIONSHIPS,
  RELATIONSHIP_LIST,
  submissionSchema,
} from "./submission";
import type { DocumentKind, SubmissionFields } from "./submission";

export type SubmittedValues = Record<keyof SubmissionFields, string | null>;

export interface StoredExtraction {
  kind: DocumentKind;
  status: ExtractionStatus;
  fields: Record<string, string>;
  warnings: string[];
}

export type FieldStatus = "matches" | "differs" | "not_extracted";

export interface FieldReview {
  field: keyof SubmissionFields;
  submitted: string | null;
  proposals: { kind: DocumentKind; value: string }[];
  status: FieldStatus;
}

const FIELD_NAMES = submissionSchema.keyof().options;

const DIACRITICS_REGEX = /\p{Diacritic}/gu;

const WHITESPACE_REGEX = /\s+/gu;

const NON_DIGITS_REGEX = /\D/gu;

function comparable(field: keyof SubmissionFields, value: string) {
  if (field === "phone") {
    return value.replaceAll(NON_DIGITS_REGEX, "");
  }

  return value
    .normalize("NFD")
    .replaceAll(DIACRITICS_REGEX, "")
    .replaceAll(WHITESPACE_REGEX, " ")
    .trim()
    .toLowerCase();
}

function present(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed || null;
}

function reviewField(
  field: keyof SubmissionFields,
  submission: SubmittedValues,
  extractions: readonly StoredExtraction[]
): FieldReview {
  const submitted = present(submission[field]);

  const proposals = extractions.flatMap(({ kind, fields }) => {
    const value = present(fields[field]);

    return value === null ? [] : [{ kind, value }];
  });

  if (proposals.length === 0) {
    return { field, submitted, proposals, status: "not_extracted" };
  }

  function agrees(value: string) {
    return (
      submitted !== null &&
      comparable(field, submitted) === comparable(field, value)
    );
  }

  return {
    field,
    submitted,
    proposals,
    status: proposals.every(({ value }) => agrees(value))
      ? "matches"
      : "differs",
  };
}

export function reviewSubmission(
  submission: SubmittedValues,
  extractions: readonly StoredExtraction[]
) {
  const fields = FIELD_NAMES.map((field) =>
    reviewField(field, submission, extractions)
  );

  const allRead = DOCUMENT_KIND_LIST.every((kind) =>
    extractions.some(
      (item) => item.kind === kind && item.status === "extracted"
    )
  );

  const needsAttention =
    !allRead ||
    fields.some(({ status }) => status === "differs") ||
    extractions.some(({ warnings }) => warnings.length > 0);

  return { fields, needsAttention };
}

export const EMPLOYEES_PAGE_SIZE = 10;

/* oxlint-disable promise/prefer-await-to-then, github/no-then -- Zod .catch(), not a Promise. */
export const employeeSearchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
});
/* oxlint-enable promise/prefer-await-to-then, github/no-then */

export const listEmployeesSchema = employeeSearchSchema.extend({
  q: z.string().max(200),
});

export const employeeIdSchema = z.object({ invitationId: z.string().min(1) });

export const EXTRACTION_STATUS_LABELS = {
  extracted: "Leído",
  unreadable: "Ilegible",
  failed: "Falló la lectura",
} satisfies Record<ExtractionStatus, string>;

const WARNING_MESSAGES = {
  not_cfe_or_telmex: "El documento no parece un recibo de CFE o Telmex.",
} satisfies Record<ExtractionWarning, string>;

export function warningMessage(warning: string) {
  const known = EXTRACTION_WARNINGS.find((item) => item === warning);

  return known ? WARNING_MESSAGES[known] : "Revisa este documento.";
}

export function displayValue(
  field: keyof SubmissionFields,
  value: string | null
) {
  if (value === null) {
    return "—";
  }

  if (field === "maritalStatus") {
    const key = MARITAL_STATUS_LIST.find((item) => item === value);

    return key ? MARITAL_STATUSES[key].label : value;
  }

  if (field === "beneficiaryRelationship") {
    const key = RELATIONSHIP_LIST.find((item) => item === value);

    return key ? RELATIONSHIPS[key].label : value;
  }

  return value;
}
