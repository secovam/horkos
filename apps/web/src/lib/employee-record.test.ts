import { describe, expect, it } from "vitest";

import { reviewSubmission } from "./employee-record";
import type { StoredExtraction, SubmittedValues } from "./employee-record";
import { DOCUMENT_KIND_LIST } from "./submission";

const SUBMITTED = {
  fullName: "María Ficticia Prueba",
  rfc: "XAXX010101AB1",
  curp: "XEXX010101HNERXX08",
  nss: "12345678901",
  maritalStatus: "married",
  phone: "5512345678",
  street: "Calle Falsa",
  extNumber: "123",
  intNumber: null,
  suburb: "Centro",
  postalCode: "01000",
  city: "Álvaro Obregón",
  state: "Ciudad de México",
  beneficiaryName: "Luis Ficticio Prueba",
  beneficiaryRelationship: "sibling",
} satisfies SubmittedValues;

function clean(
  overrides: Partial<
    Record<StoredExtraction["kind"], Partial<StoredExtraction>>
  > = {}
) {
  return DOCUMENT_KIND_LIST.map((kind): StoredExtraction => ({
    kind,
    status: "extracted",
    fields: {},
    warnings: [],
    ...overrides[kind],
  }));
}

function statusOf(
  review: ReturnType<typeof reviewSubmission>,
  field: keyof SubmittedValues
) {
  return review.fields.find((item) => item.field === field)?.status;
}

describe("reviewSubmission", () => {
  it("treats accents, case and spacing differences as a match", () => {
    const review = reviewSubmission(
      SUBMITTED,
      clean({
        tax_status: { fields: { fullName: "  MARIA   ficticia prueba " } },
      })
    );

    expect(statusOf(review, "fullName")).toBe("matches");
    expect(review.needsAttention).toBe(false);
  });

  it("compares phones by digits only", () => {
    const review = reviewSubmission(
      SUBMITTED,
      clean({ imss: { fields: { phone: "(55) 1234-5678" } } })
    );

    expect(statusOf(review, "phone")).toBe("matches");
  });

  it("flags a different value and keeps what each document proposed", () => {
    const review = reviewSubmission(
      SUBMITTED,
      clean({
        tax_status: { fields: { rfc: "XBXX020202CD3" } },
        imss: { fields: { rfc: "XAXX010101AB1" } },
      })
    );

    const rfc = review.fields.find((item) => item.field === "rfc");

    expect(rfc?.status).toBe("differs");
    expect(rfc?.proposals).toEqual([
      { kind: "tax_status", value: "XBXX020202CD3" },
      { kind: "imss", value: "XAXX010101AB1" },
    ]);
    expect(review.needsAttention).toBe(true);
  });

  it("marks a field no document proposed as not extracted without needing attention", () => {
    const review = reviewSubmission(SUBMITTED, clean());

    expect(statusOf(review, "beneficiaryName")).toBe("not_extracted");
    expect(review.needsAttention).toBe(false);
  });

  it("flags a proposal when the employee submitted nothing for the field", () => {
    const review = reviewSubmission(
      SUBMITTED,
      clean({ proof_of_address: { fields: { intNumber: "4" } } })
    );

    expect(statusOf(review, "intNumber")).toBe("differs");
  });

  it.each(["failed", "unreadable"] as const)(
    "needs attention when a document is %s",
    (status) => {
      expect(
        reviewSubmission(SUBMITTED, clean({ imss: { status } })).needsAttention
      ).toBe(true);
    }
  );

  it("needs attention when a document has no extraction", () => {
    expect(
      reviewSubmission(
        SUBMITTED,
        clean().filter(({ kind }) => kind !== "tax_status")
      ).needsAttention
    ).toBe(true);
  });

  it("needs attention when an extraction carries a warning", () => {
    expect(
      reviewSubmission(
        SUBMITTED,
        clean({ proof_of_address: { warnings: ["not_cfe_or_telmex"] } })
      ).needsAttention
    ).toBe(true);
  });
});
