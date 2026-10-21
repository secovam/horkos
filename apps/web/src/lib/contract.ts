import type { employment } from "@horkos/db/schema/employment";
import type { submission } from "@horkos/db/schema/submission";
import { PDFDocument } from "pdf-lib";

import template from "../templates/contract.pdf?inline";
import type { Sex } from "./employment";
import { RELATIONSHIPS } from "./submission";
import type { MaritalStatus } from "./submission";

type Submission = typeof submission.$inferSelect;

export type ContractSubmission = Submission & {
  maritalStatus: NonNullable<Submission["maritalStatus"]>;
  beneficiaryName: string;
  beneficiaryRelationship: NonNullable<Submission["beneficiaryRelationship"]>;
};

export type ContractEmployment = typeof employment.$inferSelect;

// Older submissions predate these fields; a contract cannot leave them blank.
export function isContractReady(
  record: Submission
): record is ContractSubmission {
  return Boolean(
    record.maritalStatus &&
    record.beneficiaryName?.trim() &&
    record.beneficiaryRelationship
  );
}

const MARITAL_STATUS_WORDS = {
  single: { male: "Soltero", female: "Soltera" },
  married: { male: "Casado", female: "Casada" },
  common_law: { male: "Unión libre", female: "Unión libre" },
} satisfies Record<MaritalStatus, Record<Sex, string>>;

const SEX_WORDS = {
  male: "Masculino",
  female: "Femenino",
} satisfies Record<Sex, string>;

const UNITS = [
  "",
  "UN",
  "DOS",
  "TRES",
  "CUATRO",
  "CINCO",
  "SEIS",
  "SIETE",
  "OCHO",
  "NUEVE",
  "DIEZ",
  "ONCE",
  "DOCE",
  "TRECE",
  "CATORCE",
  "QUINCE",
  "DIECISÉIS",
  "DIECISIETE",
  "DIECIOCHO",
  "DIECINUEVE",
  "VEINTE",
  "VEINTIÚN",
  "VEINTIDÓS",
  "VEINTITRÉS",
  "VEINTICUATRO",
  "VEINTICINCO",
  "VEINTISÉIS",
  "VEINTISIETE",
  "VEINTIOCHO",
  "VEINTINUEVE",
];

const TENS = [
  "",
  "",
  "",
  "TREINTA",
  "CUARENTA",
  "CINCUENTA",
  "SESENTA",
  "SETENTA",
  "OCHENTA",
  "NOVENTA",
];

const HUNDREDS = [
  "",
  "CIENTO",
  "DOSCIENTOS",
  "TRESCIENTOS",
  "CUATROCIENTOS",
  "QUINIENTOS",
  "SEISCIENTOS",
  "SETECIENTOS",
  "OCHOCIENTOS",
  "NOVECIENTOS",
];

// Apocopated ("UN", "VEINTIÚN") because a noun always follows: PESOS, MIL or MILLONES.
function belowThousand(n: number) {
  if (n === 100) {
    return "CIEN";
  }

  const rest = n % 100;

  const tens =
    rest < 30
      ? UNITS[rest]
      : [TENS[Math.floor(rest / 10)], UNITS[rest % 10]]
          .filter(Boolean)
          .join(" Y ");

  return [HUNDREDS[Math.floor(n / 100)], tens].filter(Boolean).join(" ");
}

function belowMillion(n: number) {
  const thousands = Math.floor(n / 1000);
  const head = thousands === 1 ? "MIL" : `${belowThousand(thousands)} MIL`;

  return [thousands ? head : "", belowThousand(n % 1000)]
    .filter(Boolean)
    .join(" ");
}

export function pesosInWords(cents: number) {
  const pesos = Math.floor(cents / 100);
  const millions = Math.floor(pesos / 1_000_000);
  const rest = pesos % 1_000_000;

  const words =
    [
      millions === 1 ? "UN MILLÓN" : "",
      millions > 1 ? `${belowMillion(millions)} MILLONES` : "",
      belowMillion(rest),
    ]
      .filter(Boolean)
      .join(" ") || "CERO";

  const currency = pesos === 1 ? "PESO" : "PESOS";
  const of = millions && !rest ? " DE" : "";

  return `${words}${of} ${currency} ${String(cents % 100).padStart(2, "0")}/100`;
}

// CURP characters 5 to 10 are the birth date (YYMMDD); character 17 is a digit before 2000 and a letter after.
export function ageFromCurp(curp: string, today: string) {
  const century = /\d/u.test(curp.charAt(16)) ? "19" : "20";
  const birth = `${century}${curp.slice(4, 6)}-${curp.slice(6, 8)}-${curp.slice(8, 10)}`;
  const years = Number(today.slice(0, 4)) - Number(birth.slice(0, 4));

  return today.slice(5) < birth.slice(5) ? years - 1 : years;
}

const salaryNumber = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// en-CA formats as YYYY-MM-DD; the contract is signed in Mexico, so its date decides the age.
const mexicoDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City",
});

export function contractFields(
  record: ContractSubmission,
  job: ContractEmployment,
  now: Date
) {
  const interior = record.intNumber ? ` Int. ${record.intNumber}` : "";

  return {
    name: record.fullName,
    nacionality: job.nationality,
    age: String(ageFromCurp(record.curp, mexicoDate.format(now))),
    sex: SEX_WORDS[job.sex],
    marital_status: MARITAL_STATUS_WORDS[record.maritalStatus][job.sex],
    curp: record.curp,
    rfc: record.rfc,
    nss: record.nss,
    address: `${record.street} ${record.extNumber}${interior}, ${record.suburb}, ${record.city}, ${record.state}, C.P. ${record.postalCode}`,
    role: job.jobTitle,
    salary_number: salaryNumber.format(job.dailySalaryCents / 100),
    salary_text: pesosInWords(job.dailySalaryCents),
    beneficiary_name: record.beneficiaryName,
    beneficiary_role: RELATIONSHIPS[record.beneficiaryRelationship].label,
  };
}

// Keys are the template's AcroForm field names, typos included ("nacionality").
export type ContractFields = ReturnType<typeof contractFields>;

export async function fillContract(fields: ContractFields) {
  const pdf = await PDFDocument.load(template);
  const form = pdf.getForm();

  for (const [name, value] of Object.entries(fields)) {
    form.getTextField(name).setText(value);
  }

  // pdf-lib types its bytes over ArrayBufferLike, which `Response` does not accept.
  return new Uint8Array(await pdf.save());
}
