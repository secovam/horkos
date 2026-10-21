import { describe, expect, test } from "vitest";

import { employmentDefaults, employmentSchema } from "./employment";

const valid = {
  workEmail: " Ana.Prueba@secovam.com ",
  personalEmail: "ana@example.com",
  jobTitle: "Analista de Compras",
  company: "SECOVAM",
  nationality: "Mexicana",
  sex: "female",
  hireDate: "2026-02-28",
  dailySalary: "695.55",
};

describe("employmentSchema", () => {
  test("lowercases emails", () => {
    expect(employmentSchema.parse(valid)).toMatchObject({
      workEmail: "ana.prueba@secovam.com",
      jobTitle: "Analista de Compras",
    });
  });

  test.each([
    ["workEmail", "ana@example.com"],
    ["workEmail", "@secovam.com"],
    ["workEmail", "a b@secovam.com"],
    ["workEmail", "ana@secovam.com.mx"],
    ["personalEmail", "ana"],
    ["jobTitle", ""],
    ["jobTitle", "Analista de calidad"],
    ["company", ""],
    ["company", "OTRA"],
    ["company", ["SERALAM"]],
    ["nationality", ""],
    ["sex", ""],
    ["sex", "other"],
    ["hireDate", ""],
    ["hireDate", "2026-02-30"],
    ["hireDate", "2026-13-01"],
    ["hireDate", "28/02/2026"],
    ["dailySalary", ""],
    ["dailySalary", "314.99"],
    ["dailySalary", "0"],
    ["dailySalary", "-400"],
    ["dailySalary", "695.555"],
    ["dailySalary", "1,200.50"],
    ["dailySalary", "abc"],
  ])("rejects %s = %j", (field, value) => {
    expect(
      employmentSchema.safeParse({ ...valid, [field]: value }).success
    ).toBe(false);
  });

  test.each([
    ["695.55", 69_555],
    [" 315 ", 31_500],
    ["1200.5", 120_050],
  ])("turns the salary %j into %d cents", (dailySalary, cents) => {
    expect(employmentSchema.parse({ ...valid, dailySalary }).dailySalary).toBe(
      cents
    );
  });

  test("accepts an empty work email", () => {
    expect(
      employmentSchema.parse({ ...valid, workEmail: "  " }).workEmail
    ).toBe("");
  });

  test("accepts a leap day", () => {
    expect(
      employmentSchema.safeParse({ ...valid, hireDate: "2028-02-29" }).success
    ).toBe(true);
  });
});

describe("employmentDefaults", () => {
  test("leaves a saved job title outside the catalog unselected", () => {
    const saved = {
      workEmail: null,
      personalEmail: "ana@example.com",
      jobTitle: "Analista de calidad",
      company: "SECOVAM",
      nationality: "Mexicana",
      sex: "female",
      hireDate: "2026-02-28",
      dailySalaryCents: 69_555,
    };

    expect(
      employmentDefaults(saved, {
        invitationEmail: "ana@example.com",
        curp: "",
      })
    ).toMatchObject({ jobTitle: "" });
  });

  const context = {
    invitationEmail: "ana@example.com",
    curp: "XEXX010101HNERXX08",
  };

  test("starts from the invitation email, the default nationality and the CURP's sex", () => {
    expect(employmentDefaults(null, context)).toEqual({
      workEmail: "",
      personalEmail: "ana@example.com",
      jobTitle: "",
      company: "",
      nationality: "Mexicana",
      sex: "male",
      hireDate: "",
      dailySalary: "",
    });
  });

  test("prefills what the alta del IMSS proposed", () => {
    expect(
      employmentDefaults(null, {
        ...context,
        proposals: { dailySalary: "695.55", hireDate: "2026-03-02" },
      })
    ).toMatchObject({ dailySalary: "695.55", hireDate: "2026-03-02" });
  });

  test.each([
    ["XEXX010101MNERXX08", "female"],
    ["XEXX010101XNERXX08", ""],
    ["XEXX", ""],
  ])("infers the sex of CURP %s as %j", (curp, sex) => {
    expect(employmentDefaults(null, { ...context, curp }).sex).toBe(sex);
  });

  test("prefers saved values and shows a missing work email as empty", () => {
    const saved = {
      ...employmentSchema.parse(valid),
      dailySalaryCents: 120_050,
      workEmail: null,
      personalEmail: "otro@example.com",
      nationality: "Colombiana",
      sex: "female",
    };

    expect(
      employmentDefaults(saved, {
        ...context,
        proposals: { dailySalary: "999.00", hireDate: "2020-01-01" },
      })
    ).toMatchObject({
      dailySalary: "1200.50",
      personalEmail: "otro@example.com",
      nationality: "Colombiana",
      sex: "female",
      workEmail: "",
      company: "SECOVAM",
      hireDate: "2026-02-28",
    });
  });
});
