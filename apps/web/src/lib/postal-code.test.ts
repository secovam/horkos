import { describe, expect, test } from "vitest";

import { applyPostalCode, matchSuburb, postalCodeArea } from "./postal-code";
import type { PostalCodeLookup } from "./postal-code";
import { submissionSchema } from "./submission";

function settlement(code: string, suburb: string) {
  return {
    d_codigo: code,
    d_asenta: suburb,
    d_mnpio: "Municipio Ficticio",
    d_estado: "Estado Ficticio",
  };
}

describe("postalCodeArea", () => {
  test("keeps only the exact code and lists each suburb once, in Spanish order", () => {
    expect(
      postalCodeArea("01000", [
        settlement("01000", "Zona Ficticia"),
        settlement("01000", "Ángeles"),
        settlement("01000", "Barrio Prueba"),
        settlement("01000", "Ángeles"),
        settlement("010001", "Otra"),
      ])
    ).toEqual({
      state: "Estado Ficticio",
      municipality: "Municipio Ficticio",
      suburbs: ["Ángeles", "Barrio Prueba", "Zona Ficticia"],
    });
  });

  test("is null when no settlement has the code", () => {
    expect(postalCodeArea("99999", [settlement("09999", "Otra")])).toBeNull();
    expect(postalCodeArea("99999", [])).toBeNull();
  });
});

describe("matchSuburb", () => {
  const suburbs = ["San Ángel", "Barrio  Prueba"];

  test("finds the catalog spelling regardless of case, accents and spacing", () => {
    expect(matchSuburb(suburbs, "SAN ANGEL")).toBe("San Ángel");
    expect(matchSuburb(suburbs, " barrio prueba ")).toBe("Barrio  Prueba");
  });

  test("finds nothing for a suburb of another code", () => {
    expect(matchSuburb(suburbs, "Centro")).toBeUndefined();
  });
});

describe("applyPostalCode", () => {
  const fields = submissionSchema.parse({
    fullName: "Ana Prueba López",
    rfc: "XAXX010101ABC",
    curp: "XEXX010101HNERXX08",
    nss: "12345678901",
    maritalStatus: "single",
    phone: "5512345678",
    street: "Calle Falsa",
    extNumber: "123",
    intNumber: "",
    suburb: "san angel",
    postalCode: "01000",
    city: "Escrito a mano",
    state: "Escrito a mano",
    beneficiaryName: "Luis Prueba López",
    beneficiaryRelationship: "sibling",
  });

  const found: PostalCodeLookup = {
    status: "found",
    state: "Ciudad de México",
    municipality: "Álvaro Obregón",
    suburbs: ["Centro", "San Ángel"],
  };

  test("takes state, municipality and the suburb's spelling from the catalog", () => {
    expect(applyPostalCode(fields, found)).toEqual({
      ok: true,
      fields: {
        ...fields,
        suburb: "San Ángel",
        city: "Álvaro Obregón",
        state: "Ciudad de México",
      },
    });
  });

  test("rejects a suburb that is not one of the code's", () => {
    expect(
      applyPostalCode({ ...fields, suburb: "Otra Colonia" }, found)
    ).toMatchObject({ ok: false });
  });

  test("rejects a code the catalog does not have", () => {
    expect(applyPostalCode(fields, { status: "not_found" })).toMatchObject({
      ok: false,
    });
  });

  test("keeps what was typed when the catalog cannot be asked", () => {
    expect(applyPostalCode(fields, { status: "unavailable" })).toEqual({
      ok: true,
      fields,
    });
  });
});
