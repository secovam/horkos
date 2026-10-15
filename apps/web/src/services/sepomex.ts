import { ENV } from "@/env.server";
import { postalCodeArea, sepomexResponseSchema } from "@/lib/postal-code";
import type { PostalCodeLookup } from "@/lib/postal-code";

// The employee is waiting on this to fill their address, so a slow catalog falls back to typing.
const SEPOMEX_TIMEOUT_MS = 5000;

// The API's maximum page size; no postal code has more settlements than this.
const PER_PAGE = 200;

// Only the postal code leaves Horkos, never who it belongs to. Failures are not logged.
export async function lookupPostalCode(
  postalCode: string
): Promise<PostalCodeLookup> {
  // Inside the try too: a missing or malformed URL is one more way the catalog is unavailable.
  try {
    const url = new URL("/api/v1/zip_codes", ENV.SEPOMEX_URL);
    url.searchParams.set("zip_code", postalCode);
    url.searchParams.set("per_page", String(PER_PAGE));

    const response = await fetch(url, {
      signal: AbortSignal.timeout(SEPOMEX_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { status: "unavailable" };
    }

    const { zip_codes } = sepomexResponseSchema.parse(await response.json());
    const area = postalCodeArea(postalCode, zip_codes);

    return area ? { status: "found", ...area } : { status: "not_found" };
  } catch {
    return { status: "unavailable" };
  }
}
