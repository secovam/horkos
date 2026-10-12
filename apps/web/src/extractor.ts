import { Container } from "@cloudflare/containers";

// Container-backed Durable Object bound as `EXTRACTOR` in alchemy.run.ts. It forwards requests
// to the PDF text server on port 8080. Kept apart from `worker.ts` so the infra stack can import
// its type without pulling in the whole Worker.
export class Extractor extends Container {
  defaultPort = 8080;
  sleepAfter = "5m";
}
