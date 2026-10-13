import { LiteParse } from "@llamaindex/liteparse";

const MAX_PAGES = 5;

// Baked into the image: LiteParse would otherwise download it from GitHub on the first OCR.
const tessdataPath = process.env.TESSDATA_PATH;

const shared = {
  outputFormat: "markdown",
  maxPages: MAX_PAGES,
  quiet: true,
  ocrLanguage: "eng",
  tessdataPath,
} as const;

const parserWithOcr = new LiteParse({ ...shared, ocrEnabled: true });

const parserWithoutOcr = new LiteParse({ ...shared, ocrEnabled: false });

// OCR is slow, so it only runs when a page has no usable text layer.
export async function extractText(bytes: Uint8Array) {
  const complexity = await parserWithOcr.isComplex(bytes);
  const needsOcr = complexity.some((page) => page.needsOcr);
  const parser = needsOcr ? parserWithOcr : parserWithoutOcr;
  const result = await parser.parse(bytes);

  return result.text ?? null;
}
