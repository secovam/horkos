import { describe, expect, test } from "vitest";

import {
  MAX_DOCUMENT_BYTES,
  detectDocumentType,
  documentFileSchema,
  employeeObjectKey,
  submissionSchema,
} from "./submission";

const valid = {
  fullName: "  Ana Prueba López ",
  rfc: " xaxx010101abc ",
  curp: "xexx010101hnerxx08",
  nss: "12345678901",
  street: "Calle Falsa",
  extNumber: "123",
  intNumber: "",
  suburb: "Centro",
  postalCode: "01000",
  city: "Benito Juárez",
  state: "Ciudad de México",
};

describe("detectDocumentType", () => {
  test.each([
    ["PDF", [0x25, 0x50, 0x44, 0x46, 0x2d], "application/pdf"],
    ["JPEG", [0xff, 0xd8, 0xff, 0xe0], "image/jpeg"],
    ["PNG", [0x89, 0x50, 0x4e, 0x47, 0x0d], "image/png"],
  ])("recognizes %s by its first bytes", (_name, bytes, expected) => {
    expect(detectDocumentType(new Uint8Array(bytes))).toBe(expected);
  });

  test("rejects a file whose bytes are not an allowed type", () => {
    const script = new TextEncoder().encode("<script>alert(1)</script>");

    expect(detectDocumentType(script)).toBeNull();
    expect(detectDocumentType(new Uint8Array())).toBeNull();
    expect(detectDocumentType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

function sized(size: number) {
  return new File([new Uint8Array(size)], "a.pdf");
}

describe("documentFileSchema", () => {
  test("accepts sizes up to the limit and rejects empty, larger or missing files", () => {
    expect(
      documentFileSchema.safeParse(sized(MAX_DOCUMENT_BYTES)).success
    ).toBe(true);
    expect(documentFileSchema.safeParse(sized(0)).success).toBe(false);
    expect(
      documentFileSchema.safeParse(sized(MAX_DOCUMENT_BYTES + 1)).success
    ).toBe(false);
    expect(documentFileSchema.safeParse(null).success).toBe(false);
  });
});

describe("employeeObjectKey", () => {
  test("is deterministic and leaves the hr prefix free", () => {
    expect(employeeObjectKey("abc", "imss")).toBe(
      "invitations/abc/employee/imss"
    );
  });
});

describe("submissionSchema", () => {
  test("trims, uppercases RFC and CURP, and allows an empty interior number", () => {
    expect(submissionSchema.parse(valid)).toMatchObject({
      fullName: "Ana Prueba López",
      rfc: "XAXX010101ABC",
      curp: "XEXX010101HNERXX08",
      intNumber: "",
    });
  });

  test.each([
    ["rfc", "XAX010101ABC"],
    ["rfc", "XAXX010101AB"],
    ["curp", "XEXX010101KNERXX08"],
    ["curp", "XEXX010101HNERXX0"],
    ["nss", "1234567890"],
    ["nss", "1234567890a"],
    ["postalCode", "1000"],
    ["postalCode", "010000"],
    ["fullName", "   "],
    ["street", ""],
  ])("rejects %s = %j", (field, value) => {
    expect(
      submissionSchema.safeParse({ ...valid, [field]: value }).success
    ).toBe(false);
  });

  test("accepts an RFC with Ñ and &", () => {
    expect(
      submissionSchema.safeParse({ ...valid, rfc: "ÑA&X010101AB1" }).success
    ).toBe(true);
  });
});
