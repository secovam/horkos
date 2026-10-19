import { z } from "zod";

export const OFFICE_LIST = [
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

export type Office = (typeof OFFICE_LIST)[number];

export const DEPARTMENT_LIST = [
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

export type Department = (typeof DEPARTMENT_LIST)[number];

export const COMPANY_LIST = [
  "SERALAM",
  "SECOVAM",
  "LABAIND",
  "SECOLAM",
] as const;

export type Company = (typeof COMPANY_LIST)[number];

export const SEX_LIST = ["male", "female"] as const;

export type Sex = (typeof SEX_LIST)[number];

export const SEXES = {
  male: { label: "Masculino" },
  female: { label: "Femenino" },
} satisfies Record<Sex, { label: string }>;

export const DEFAULT_NATIONALITY = "Mexicana";

export const WORK_EMAIL_DOMAIN = "@secovam.com";

// A string first, so the form can start with nothing chosen.
function choice<const T extends readonly [string, ...string[]]>(
  values: T,
  error: string
) {
  return z.string({ error }).pipe(z.enum(values, { error }));
}

function required(message: string) {
  return z.string().trim().min(1, message).max(200, "Es demasiado largo.");
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const employmentSchema = z.object({
  workEmail: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(
      z
        .email("Escribe un correo de trabajo válido.")
        .refine(
          (value) => value.endsWith(WORK_EMAIL_DOMAIN),
          `El correo de trabajo termina en ${WORK_EMAIL_DOMAIN}.`
        )
    ),
  personalEmail: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Escribe un correo personal válido.")),
  jobTitle: required("Escribe el puesto."),
  department: choice(DEPARTMENT_LIST, "Elige el departamento."),
  manager: z.string().trim().max(200, "Es demasiado largo."),
  office: choice(OFFICE_LIST, "Elige la oficina."),
  companies: z.array(z.string(), { error: "Elige al menos una empresa." }).pipe(
    z
      .array(z.enum(COMPANY_LIST, { error: "Elige una empresa válida." }))
      .min(1, "Elige al menos una empresa.")
      .refine(
        (values) => new Set(values).size === values.length,
        "Una empresa no puede repetirse."
      )
  ),
  nationality: required("Escribe la nacionalidad."),
  sex: choice(SEX_LIST, "Elige el sexo."),
  hireDate: z.string().refine(isIsoDate, "Elige una fecha de ingreso válida."),
});

export type EmploymentInput = z.input<typeof employmentSchema>;

export type EmploymentFields = z.output<typeof employmentSchema>;

export const EMPLOYMENT_FIELDS = {
  workEmail: { label: "Correo de trabajo" },
  personalEmail: { label: "Correo personal" },
  jobTitle: { label: "Puesto" },
  department: { label: "Departamento" },
  manager: { label: "Jefe inmediato (opcional)" },
  office: { label: "Oficina" },
  companies: { label: "Empresas" },
  nationality: { label: "Nacionalidad" },
  sex: { label: "Sexo" },
  hireDate: { label: "Fecha de ingreso" },
} satisfies Record<keyof EmploymentFields, { label: string }>;

export interface StoredEmployment {
  workEmail: string;
  personalEmail: string;
  jobTitle: string;
  department: string;
  manager: string | null;
  office: string;
  companies: string[];
  nationality: string;
  sex: string;
  hireDate: string;
}

// CURP position 11 is the sex: H (hombre) or M (mujer).
function sexFromCurp(curp: string) {
  const letter = curp.trim().toUpperCase().charAt(10);

  if (letter === "H") {
    return "male";
  }

  return letter === "M" ? "female" : "";
}

export function employmentDefaults(
  saved: StoredEmployment | null,
  { invitationEmail, curp }: { invitationEmail: string; curp: string }
): EmploymentInput {
  if (saved) {
    return {
      workEmail: saved.workEmail,
      personalEmail: saved.personalEmail,
      jobTitle: saved.jobTitle,
      department: saved.department,
      manager: saved.manager ?? "",
      office: saved.office,
      companies: saved.companies,
      nationality: saved.nationality,
      sex: saved.sex,
      hireDate: saved.hireDate,
    };
  }

  return {
    workEmail: "",
    personalEmail: invitationEmail,
    jobTitle: "",
    department: "",
    manager: "",
    office: "",
    companies: [],
    nationality: DEFAULT_NATIONALITY,
    sex: sexFromCurp(curp),
    hireDate: "",
  };
}
