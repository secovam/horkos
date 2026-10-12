/* oxlint-disable prefer-named-capture-group, sonarjs/super-linear-regex -- Patterns ported from the SAT, IMSS and utility-bill layouts; they run on at most five pages of text. */
import { submissionSchema } from "./submission";
import type { DocumentKind, SubmissionInput } from "./submission";

export type ExtractedFields = Partial<Record<keyof SubmissionInput, string>>;

export const EXTRACTION_WARNINGS = ["not_cfe_or_telmex"] as const;

export type ExtractionWarning = (typeof EXTRACTION_WARNINGS)[number];

export const EXTRACTION_STATUSES = [
  "extracted",
  "unreadable",
  "failed",
] as const;

export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

// What the employee's browser gets back: proposals only, never document text.
export interface ExtractionResult {
  status: ExtractionStatus;
  fields: ExtractedFields;
  warnings: string[];
}

export const FAILED_EXTRACTION = {
  status: "failed",
  fields: {},
  warnings: [],
} satisfies ExtractionResult;

export const UNREADABLE_EXTRACTION = {
  status: "unreadable",
  fields: {},
  warnings: [],
} satisfies ExtractionResult;

export interface ParsedDocument {
  fields: ExtractedFields;
  warnings: ExtractionWarning[];
}

const PIPE_REGEX = /\|/gu;

const WHITESPACE_SPLIT_REGEX = /\s+/u;

const RFC_REGEX = /RFC[:\s|]+([A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3})/iu;

const CURP_REGEX = /CURP[:\s|]+([A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d)/iu;

const NOMBRE_REGEX = /Nombre\s*\(s\)[:\s|]+([^\n|]+)/iu;

const PRIMER_APELLIDO_REGEX = /Primer\s+Apellido[:\s|]+([^\n|]+)/iu;

const SEGUNDO_APELLIDO_REGEX = /Segundo\s+Apellido[:\s|]+([^\n|]+)/iu;

const CODIGO_POSTAL_REGEX = /(?:C[oó]digo\s+Postal|C\.?\s?P\.?)[:\s]+(\d{5})/iu;

const VIALIDAD_REGEX =
  /(?:Nombre\s+de\s+(?:la\s+)?Vialidad|Calle|Domicilio)[:\s]+([^\n|]+)/iu;

const NUMERO_EXTERIOR_REGEX =
  /N[uú]mero\s*Exterior[:\s]+([^\n|,]+)|No\.?\s*Ext(?:erior)?\.?[:\s]+([^\n|,]+)/iu;

const NUMERO_INTERIOR_REGEX =
  /N[uú]mero\s*Interior[:\s]+([^\n|,]+)|No\.?\s*Int(?:erior)?\.?[:\s]+([^\n|,]+)/iu;

const COLONIA_REGEX = /Colonia[:\s]+([^\n|,]+)/iu;

const MUNICIPIO_REGEX = /(?:Municipio|Delegaci[oó]n)[:\s]+([^\n|,]+)/iu;

const ESTADO_REGEX = /Estado[:\s]+([^\n|,]+)/iu;

const CP_ABBR_REGEX = /C\.P\.?\s*(\d{5})/u;

const CFE_ADDRESS_LINE_REGEX = /######\s*([^\n]+?)C\.P\.?\s*\d{5}/iu;

const TELMEX_ADDRESS_LINE_REGEX = /^CLL\s+([^\n]+)$/imu;

const STREET_NUMBER_SPLIT_REGEX = /^(.*?)\s+(\d+)\s*(.*)$/u;

const SEGURIDAD_SOCIAL_REGEX = /Seguridad\s+Social[:\s]*(\d{11})/iu;

const NSS_FALLBACK_REGEX =
  /(?:N[uú]mero\s+de\s+Seguro\s+Social|NSS)[:\s]*(\d{11})/iu;

const CURP_CADENA_REGEX = /Curp[:\s]*([A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d)/iu;

const CFE_ISSUER_REGEX = /\bCFE\b|Comisi[oó]n\s+Federal\s+de\s+Electricidad/iu;

const TELMEX_ISSUER_REGEX = /\bTELMEX\b|Tel[eé]fonos\s+de\s+M[eé]xico/iu;

function cleanCell(value: string) {
  return value.replace(PIPE_REGEX, "").trim();
}

function toTitleCase(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .split(WHITESPACE_SPLIT_REGEX)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseSat(markdown: string): ExtractedFields {
  const fields: ExtractedFields = {};

  const rfc = markdown.match(RFC_REGEX)?.[1];
  const curp = markdown.match(CURP_REGEX)?.[1];

  if (rfc) {
    fields.rfc = rfc;
  }

  if (curp) {
    fields.curp = curp;
  }

  const name = [NOMBRE_REGEX, PRIMER_APELLIDO_REGEX, SEGUNDO_APELLIDO_REGEX]
    .flatMap((regex) => cleanCell(markdown.match(regex)?.[1] ?? "") || [])
    .join(" ");

  if (name) {
    fields.fullName = toTitleCase(name);
  }

  return fields;
}

// "JOYA AGATA 136 CUMBRES LA JOYA": the first standalone number splits street from suburb.
function splitStreetLine(raw: string): ExtractedFields {
  const match = cleanCell(raw).match(STREET_NUMBER_SPLIT_REGEX);

  if (!match) {
    const street = cleanCell(raw);

    return street ? { street } : {};
  }

  const [, streetPart, extNumber, rest] = match;
  const fields: ExtractedFields = { extNumber };
  const street = cleanCell(streetPart);
  const suburb = cleanCell(rest);

  if (street) {
    fields.street = street;
  }

  if (suburb) {
    fields.suburb = suburb;
  }

  return fields;
}

function parseAddressLine(markdown: string, lineRegex: RegExp) {
  const fields: ExtractedFields = {};
  const line = markdown.match(lineRegex)?.[1];

  if (line) {
    Object.assign(fields, splitStreetLine(line));
  }

  const postalCode = markdown.match(CP_ABBR_REGEX)?.[1];

  if (postalCode) {
    fields.postalCode = postalCode;
  }

  return fields;
}

const GENERIC_ADDRESS_FIELDS = [
  { name: "postalCode", regex: CODIGO_POSTAL_REGEX },
  { name: "street", regex: VIALIDAD_REGEX },
  { name: "extNumber", regex: NUMERO_EXTERIOR_REGEX },
  { name: "intNumber", regex: NUMERO_INTERIOR_REGEX },
  { name: "suburb", regex: COLONIA_REGEX },
  { name: "city", regex: MUNICIPIO_REGEX },
  { name: "state", regex: ESTADO_REGEX },
] as const;

const NO_INTERIOR_NUMBER = new Set(["S/N", "N/A"]);

function parseGenericAddress(markdown: string): ExtractedFields {
  const fields: ExtractedFields = {};

  for (const { name, regex } of GENERIC_ADDRESS_FIELDS) {
    const match = markdown.match(regex);
    const value = cleanCell(match?.[1] ?? match?.[2] ?? "");

    if (
      value &&
      !(name === "intNumber" && NO_INTERIOR_NUMBER.has(value.toUpperCase()))
    ) {
      fields[name] = value;
    }
  }

  return fields;
}

function parseAddress(markdown: string): ExtractedFields {
  if (TELMEX_ADDRESS_LINE_REGEX.test(markdown)) {
    return parseAddressLine(markdown, TELMEX_ADDRESS_LINE_REGEX);
  }

  if (CFE_ADDRESS_LINE_REGEX.test(markdown)) {
    return parseAddressLine(markdown, CFE_ADDRESS_LINE_REGEX);
  }

  return parseGenericAddress(markdown);
}

function parseImss(markdown: string): ExtractedFields {
  const fields: ExtractedFields = {};

  const nss =
    markdown.match(SEGURIDAD_SOCIAL_REGEX)?.[1] ??
    markdown.match(NSS_FALLBACK_REGEX)?.[1];

  const curp = markdown.match(CURP_CADENA_REGEX)?.[1];

  if (nss) {
    fields.nss = nss;
  }

  if (curp) {
    fields.curp = curp;
  }

  return fields;
}

function parseProofOfAddress(markdown: string): ParsedDocument {
  const isKnownIssuer =
    CFE_ISSUER_REGEX.test(markdown) || TELMEX_ISSUER_REGEX.test(markdown);

  return {
    fields: parseAddress(markdown),
    warnings: isKnownIssuer ? [] : ["not_cfe_or_telmex"],
  };
}

function withoutWarnings(parse: (markdown: string) => ExtractedFields) {
  return (markdown: string): ParsedDocument => ({
    fields: parse(markdown),
    warnings: [],
  });
}

const PARSERS = {
  tax_status: withoutWarnings(parseSat),
  imss: withoutWarnings(parseImss),
  proof_of_address: parseProofOfAddress,
} satisfies Record<DocumentKind, (markdown: string) => ParsedDocument>;

// SAFETY: the shape's keys are exactly the keys of SubmissionInput.
const FIELD_NAMES = Object.keys(
  submissionSchema.shape
) as (keyof SubmissionInput)[];

// Regexes propose, the form's own field rules decide: a value the employee could not submit is not worth prefilling.
function keepValidFields(fields: ExtractedFields) {
  const valid: ExtractedFields = {};

  for (const name of FIELD_NAMES) {
    const parsed = submissionSchema.shape[name].safeParse(fields[name]);

    if (parsed.success && parsed.data) {
      valid[name] = parsed.data;
    }
  }

  return valid;
}

export function parseDocument(
  kind: DocumentKind,
  markdown: string
): ParsedDocument {
  const { fields, warnings } = PARSERS[kind](markdown);

  return { fields: keepValidFields(fields), warnings };
}
