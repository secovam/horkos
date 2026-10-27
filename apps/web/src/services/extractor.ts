import { getRandom } from "@cloudflare/containers";
import { z } from "zod";

import { ENV } from "@/env.server";
import {
  FAILED_EXTRACTION,
  UNREADABLE_EXTRACTION,
  parseDocument,
  parseImssRegistration,
} from "@/lib/extraction";
import type {
  ExtractionResult,
  ImssRegistrationResult,
} from "@/lib/extraction";
import type { DocumentKind } from "@/lib/submission";

// The only cap on extractor containers: each Durable Object instance runs one.
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

// A container that is still starting fails fast, so that failure gets one more try. A timeout
// does not: the PDF itself is slow, and a second wait would double it.
async function readTextOnceMore(bytes: ArrayBuffer) {
  try {
    return await readText(bytes);
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw error;
    }

    return readText(bytes);
  }
}

type TextRead =
  | { status: "extracted"; text: string }
  | { status: "failed" | "unreadable" };

// A container failure must never fail the upload: the person types by hand instead.
// Nothing here is logged, since errors and text can quote personal data.
async function readDocumentText(bytes: ArrayBuffer): Promise<TextRead> {
  let text: string | null;

  try {
    text = await readTextOnceMore(bytes);
  } catch {
    return { status: "failed" };
  }

  return text?.trim()
    ? { status: "extracted", text }
    : { status: "unreadable" };
}

export async function extractDocument(
  kind: DocumentKind,
  bytes: ArrayBuffer
): Promise<ExtractionResult> {
  const read = await readDocumentText(bytes);

  if (read.status === "extracted") {
    return { status: "extracted", ...parseDocument(kind, read.text) };
  }

  return read.status === "failed" ? FAILED_EXTRACTION : UNREADABLE_EXTRACTION;
}

export async function extractImssRegistration(
  bytes: ArrayBuffer
): Promise<ImssRegistrationResult> {
  const read = await readDocumentText(bytes);

  if (read.status === "extracted") {
    return {
      status: "extracted",
      fields: parseImssRegistration(read.text),
      warnings: [],
    };
  }

  return read.status === "failed" ? FAILED_EXTRACTION : UNREADABLE_EXTRACTION;
}
