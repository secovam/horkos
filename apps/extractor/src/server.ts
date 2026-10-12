import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

import { extractText } from "./extract-text.ts";

const PORT = 8080;

const MAX_BODY_BYTES = 10 * 1024 * 1024;

// Returns null once the body passes the cap, so the caller can answer 413.
async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of request) {
    total += chunk.length;

    if (total > MAX_BODY_BYTES) {
      return null;
    }

    chunks.push(chunk);
  }

  return new Uint8Array(Buffer.concat(chunks));
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: Record<string, string | null>
) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

// Logs carry only the error type: messages can quote document content.
async function handleText(request: IncomingMessage, response: ServerResponse) {
  const bytes = await readBody(request);

  if (!bytes) {
    sendJson(response, 413, { error: "too_large" });

    return;
  }

  try {
    sendJson(response, 200, { text: await extractText(bytes) });
  } catch (error) {
    // A PDF LiteParse cannot open is a normal case, not a server fault.
    console.error(
      "extract failed",
      error instanceof Error ? error.name : "unknown"
    );
    sendJson(response, 200, { text: null });
  }
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200).end("ok");

    return;
  }

  if (request.method === "POST" && request.url === "/text") {
    await handleText(request, response);

    return;
  }

  sendJson(response, 404, { error: "not_found" });
}

const server = createServer(async (request, response) => {
  try {
    await handle(request, response);
  } catch (error) {
    console.error(
      "request failed",
      error instanceof Error ? error.name : "unknown"
    );
    sendJson(response, 500, { error: "internal" });
  }
});

server.listen(PORT, () => {
  console.log(`extractor listening on ${PORT}`);
});
