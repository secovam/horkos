import { describe, expect, test } from "vitest";

import { employmentDefaults, employmentSchema } from "./employment";

const valid = {
  workEmail: " Ana.Prueba@secovam.com ",
  personalEmail: "ana@example.com",
  jobTitle: " Analista ",
  department: "Calidad",
  manager: "",
  office: "CDMX",
  companies: ["SERALAM", "SECOVAM"],
  nationality: "Mexicana",
  sex: "female",
  hireDate: "2026-02-28",
};

describe("employmentSchema", () => {
  test("trims text, lowercases emails and allows an empty manager", () => {
    expect(employmentSchema.parse(valid)).toMatchObject({
      workEmail: "ana.prueba@secovam.com",
      jobTitle: "Analista",
      manager: "",
    });
  });

  test.each([
    ["workEmail", "ana@example.com"],
    ["workEmail", "@secovam.com"],
    ["workEmail", "a b@secovam.com"],
    ["workEmail", ""],
    ["personalEmail", "ana"],
    ["jobTitle", "  "],
    ["department", ""],
    ["department", "Cocina"],
    ["office", "Marte"],
    ["companies", []],
    ["companies", ["OTRA"]],
    ["companies", ["SERALAM", "SERALAM"]],
    ["nationality", ""],
    ["sex", ""],
    ["sex", "other"],
    ["hireDate", ""],
    ["hireDate", "2026-02-30"],
    ["hireDate", "2026-13-01"],
    ["hireDate", "28/02/2026"],
  ])("rejects %s = %j", (field, value) => {
    expect(
      employmentSchema.safeParse({ ...valid, [field]: value }).success
    ).toBe(false);
  });

  test("accepts a leap day", () => {
    expect(
      employmentSchema.safeParse({ ...valid, hireDate: "2028-02-29" }).success
    ).toBe(true);
  });
});

describe("employmentDefaults", () => {
  const context = {
    invitationEmail: "ana@example.com",
    curp: "XEXX010101HNERXX08",
  };

  test("starts from the invitation email, the default nationality and the CURP's sex", () => {
    expect(employmentDefaults(null, context)).toEqual({
      workEmail: "",
      personalEmail: "ana@example.com",
      jobTitle: "",
      department: "",
      manager: "",
      office: "",
      companies: [],
      nationality: "Mexicana",
      sex: "male",
      hireDate: "",
    });
  });

  test.each([
    ["XEXX010101MNERXX08", "female"],
    ["XEXX010101XNERXX08", ""],
    ["XEXX", ""],
  ])("infers the sex of CURP %s as %j", (curp, sex) => {
    expect(employmentDefaults(null, { ...context, curp }).sex).toBe(sex);
  });

  test("prefers saved values and shows a missing manager as empty", () => {
    const saved = {
      ...employmentSchema.parse(valid),
      manager: null,
      personalEmail: "otro@example.com",
      nationality: "Colombiana",
      sex: "female",
    };

    expect(employmentDefaults(saved, context)).toMatchObject({
      personalEmail: "otro@example.com",
      nationality: "Colombiana",
      sex: "female",
      manager: "",
      companies: ["SERALAM", "SECOVAM"],
    });
  });
});
