import { useQuery } from "@tanstack/react-query";

import { POSTAL_CODE_REGEX } from "@/lib/postal-code";
import type { PostalCodeLookup } from "@/lib/postal-code";

type PostalCodeStatus =
  | "incomplete"
  | "searching"
  | "unavailable"
  | "not_found"
  | "found";

// `problem` shows on the postal code right away; `blocker` stops the submit.
interface PostalCodeGuidance {
  hint?: string;
  problem?: string;
  blocker?: string;
}

const NOT_FOUND = "No encontramos este código postal. Revísalo.";

const GUIDANCE = {
  incomplete: {
    hint: "Con tu código postal llenamos colonia, municipio y estado.",
  },
  searching: {
    hint: "Buscando tu código postal…",
    blocker: "Espera a que terminemos de buscar tu código postal.",
  },
  unavailable: {
    hint: "No pudimos consultar los códigos postales. Escribe colonia, municipio y estado.",
  },
  not_found: { problem: NOT_FOUND, blocker: NOT_FOUND },
  found: {},
} satisfies Record<PostalCodeStatus, PostalCodeGuidance>;

// Looks up each complete postal code once, through whichever server function the caller may use.
// Address fields stay locked unless the catalog could not be asked.
export function usePostalCode(
  postalCode: string,
  find: (postalCode: string) => Promise<PostalCodeLookup>
) {
  const searchable = POSTAL_CODE_REGEX.test(postalCode);

  const { data, isError } = useQuery({
    queryKey: ["postal-code", postalCode],
    queryFn: () => find(postalCode),
    enabled: searchable,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  let status: PostalCodeStatus = "searching";

  if (!searchable) {
    status = "incomplete";
  } else if (isError) {
    status = "unavailable";
  } else if (data) {
    ({ status } = data);
  }

  const guidance: PostalCodeGuidance = GUIDANCE[status];

  return {
    area: data?.status === "found" ? data : null,
    locked: status !== "unavailable",
    ...guidance,
  };
}
