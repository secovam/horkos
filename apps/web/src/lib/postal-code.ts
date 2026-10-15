import { z } from "zod";

import type { SubmissionFields } from "./submission";

export const POSTAL_CODE_REGEX = /^\d{5}$/u;

// One row per settlement, as the Sepomex API returns it. Fields we do not use are ignored.
export const sepomexResponseSchema = z.object({
  zip_codes: z.array(
    z.object({
      d_codigo: z.string(),
      d_asenta: z.string(),
      d_mnpio: z.string(),
      d_estado: z.string(),
    })
  ),
});

type SepomexSettlement = z.infer<
  typeof sepomexResponseSchema
>["zip_codes"][number];

export interface PostalCodeArea {
  state: string;
  municipality: string;
  suburbs: string[];
}

// `unavailable` means the catalog could not be asked, so the employee types the address instead.
export type PostalCodeLookup =
  | ({ status: "found" } & PostalCodeArea)
  | { status: "not_found" }
  | { status: "unavailable" };

// The API matches `zip_code` partially, so only rows for exactly this code count.
// A postal code belongs to a single municipality, so the first row names it.
export function postalCodeArea(
  postalCode: string,
  settlements: readonly SepomexSettlement[]
): PostalCodeArea | null {
  const matching = settlements.filter(
    ({ d_codigo }) => d_codigo === postalCode
  );

  if (matching.length === 0) {
    return null;
  }

  const suburbs = [...new Set(matching.map(({ d_asenta }) => d_asenta))];
  suburbs.sort((a, b) => a.localeCompare(b, "es"));

  return {
    state: matching[0].d_estado,
    municipality: matching[0].d_mnpio,
    suburbs,
  };
}

function comparable(value: string) {
  return value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

// Documents print suburbs in capitals and often without accents ("SAN ANGEL"), so the catalog's
// spelling is found by comparing both loosely.
export function matchSuburb(suburbs: readonly string[], value: string) {
  const wanted = comparable(value);

  return suburbs.find((suburb) => comparable(suburb) === wanted);
}

// The browser locks these fields, but the server cannot trust that: a found postal code decides
// the state and municipality, and the suburb must be one of its own. An unavailable catalog keeps
// what the employee typed, since HR reviews it anyway.
export function applyPostalCode(
  fields: SubmissionFields,
  lookup: PostalCodeLookup
): { ok: true; fields: SubmissionFields } | { ok: false; message: string } {
  switch (lookup.status) {
    case "unavailable": {
      return { ok: true, fields };
    }

    case "not_found": {
      return {
        ok: false,
        message: "No encontramos tu código postal. Revísalo.",
      };
    }

    default: {
      const suburb = matchSuburb(lookup.suburbs, fields.suburb);

      if (!suburb) {
        return { ok: false, message: "Elige tu colonia de la lista." };
      }

      return {
        ok: true,
        fields: {
          ...fields,
          suburb,
          city: lookup.municipality,
          state: lookup.state,
        },
      };
    }
  }
}
