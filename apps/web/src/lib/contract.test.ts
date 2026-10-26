import { PDFDocument } from "pdf-lib";
import { describe, expect, test } from "vitest";

import {
  ageFromCurp,
  contractFields,
  fillContract,
  isContractReady,
  pesosInWords,
} from "./contract";

const record = {
  invitationId: "inv-1",
  fullName: "Maria Ficticia Prueba",
  rfc: "XAXX010101AB1",
  curp: "XAXX900315MDFXXX09",
  nss: "12345678901",
  street: "Calle Inventada",
  extNumber: "12",
  intNumber: "3B",
  suburb: "Colonia Ejemplo",
  postalCode: "07280",
  city: "Gustavo A. Madero",
  state: "Ciudad de México",
  maritalStatus: "married" as const,
  phone: "5512345678",
  beneficiaryName: "Juan Ficticio Prueba",
  beneficiaryRelationship: "spouse" as const,
  createdAt: new Date("2026-10-01T00:00:00Z"),
};

const job = {
  invitationId: "inv-1",
  workEmail: null,
  personalEmail: "maria@example.com",
  jobTitle: "Analista de Compras" as const,
  company: "SECOLAM" as const,
  nationality: "Mexicana",
  sex: "female" as const,
  hireDate: "2026-03-02",
  dailySalaryCents: 69_555,
  updatedAt: new Date("2026-10-01T00:00:00Z"),
};

describe("pesosInWords", () => {
  test.each([
    [31_500, "TRESCIENTOS QUINCE PESOS 00/100"],
    [69_555, "SEISCIENTOS NOVENTA Y CINCO PESOS 55/100"],
    [100, "UN PESO 00/100"],
    [10_000, "CIEN PESOS 00/100"],
    [10_105, "CIENTO UN PESOS 05/100"],
    [2100, "VEINTIÚN PESOS 00/100"],
    [3100, "TREINTA Y UN PESOS 00/100"],
    [100_000, "MIL PESOS 00/100"],
    [123_450, "MIL DOSCIENTOS TREINTA Y CUATRO PESOS 50/100"],
    [2_100_000, "VEINTIÚN MIL PESOS 00/100"],
    [100_000_000, "UN MILLÓN DE PESOS 00/100"],
    [250_000_099, "DOS MILLONES QUINIENTOS MIL PESOS 99/100"],
  ])("%i cents reads %s", (cents, words) => {
    expect(pesosInWords(cents)).toBe(words);
  });
});

describe("ageFromCurp", () => {
  test("counts the birthday only once it has passed", () => {
    expect(ageFromCurp("XAXX900315MDFXXX09", "2026-03-14")).toBe(35);
    expect(ageFromCurp("XAXX900315MDFXXX09", "2026-03-15")).toBe(36);
  });

  test("a letter in position 17 means born in the 2000s", () => {
    expect(ageFromCurp("XAXX050101HDFXXXA1", "2026-10-21")).toBe(21);
  });
});

describe("contractFields", () => {
  test("words the record for the contract", () => {
    // 05:59 UTC on Mar 15 is still Mar 14 in Mexico City, the day before her birthday.
    expect(
      contractFields(record, job, new Date("2026-03-15T05:59:00Z"))
    ).toEqual({
      name: "Maria Ficticia Prueba",
      nacionality: "Mexicana",
      age: "35",
      sex: "Femenino",
      marital_status: "Casada",
      curp: "XAXX900315MDFXXX09",
      rfc: "XAXX010101AB1",
      nss: "12345678901",
      address:
        "Calle Inventada 12 Int. 3B, Colonia Ejemplo, Gustavo A. Madero, Ciudad de México, C.P. 07280",
      role: "Analista de Compras",
      salary_number: "695.55",
      salary_text: "SEISCIENTOS NOVENTA Y CINCO PESOS 55/100",
      beneficiary_name: "Juan Ficticio Prueba",
      beneficiary_role: "Cónyuge",
    });
  });

  test("leaves the interior number out when there is none", () => {
    expect(
      contractFields({ ...record, intNumber: null }, job, new Date()).address
    ).toBe(
      "Calle Inventada 12, Colonia Ejemplo, Gustavo A. Madero, Ciudad de México, C.P. 07280"
    );
  });
});

test("a submission without beneficiary is not ready for a contract", () => {
  expect(isContractReady(record)).toBe(true);
  expect(isContractReady({ ...record, beneficiaryName: " " })).toBe(false);
  expect(isContractReady({ ...record, maritalStatus: null })).toBe(false);
});

test("fills every field of the template as a read-only form field", async () => {
  const fields = contractFields(record, job, new Date());
  const pdf = await PDFDocument.load(await fillContract(fields));
  const form = pdf.getForm();

  expect(pdf.getPageCount()).toBe(5);
  expect(
    Object.fromEntries(
      form
        .getFields()
        .map((field) => [
          field.getName(),
          form.getTextField(field.getName()).getText(),
        ])
    )
  ).toEqual(fields);
  expect(form.getFields().every((field) => field.isReadOnly())).toBe(true);
});
