import { getRandom } from "@cloudflare/containers";
import { z } from "zod";

import { ENV } from "@/env.server";
import {
  FAILED_EXTRACTION,
  UNREADABLE_EXTRACTION,
  parseDocument,
} from "@/lib/extraction";
import type { ExtractionResult } from "@/lib/extraction";
import type { DocumentKind } from "@/lib/submission";

// Matches `maxInstances` in alchemy.run.ts.
const CONTAINER_INSTANCES = 3;

// Cold start plus OCR on a scanned page.
const EXTRACTOR_TIMEOUT_MS = 60_000;

const textResponseSchema = z.object({ text: z.string().nullable() });

async function readText(bytes: ArrayBuffer) {
  const container = await getRandom(ENV.EXTRACTOR, CONTAINER_INSTANCES);

  const response = await container.fetch(
    // oxlint-disable-next-line sonarjs/no-clear-text-protocols -- Only names the route: the Durable Object stub never leaves Cloudflare.
    new Request("http://extractor/text", {
      method: "POST",
      body: bytes,
      signal: AbortSignal.timeout(EXTRACTOR_TIMEOUT_MS),
    })
  );

  if (!response.ok) {
    throw new Error("extractor_error");
  }

  return textResponseSchema.parse(await response.json()).text;
}

// A container failure must never fail the upload: the employee types by hand instead.
// Nothing here is logged, since errors and text can quote personal data.
export async function extractDocument(
  kind: DocumentKind,
  bytes: ArrayBuffer
): Promise<ExtractionResult> {
  let text: string | null;

  try {
    text = await readText(bytes);
  } catch {
    return FAILED_EXTRACTION;
  }

  if (!text?.trim()) {
    return UNREADABLE_EXTRACTION;
  }

  return { status: "extracted", ...parseDocument(kind, text) };
}
