import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";
import { Miniflare } from "miniflare";
import type { MiniflareOptions } from "miniflare";
import { z } from "zod";

const webRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

const migrationRoot = path.resolve(webRoot, "../../packages/db/src/migrations");

// A test PDF containing this marker makes the stand-in extractor answer 500.
export const EXTRACTOR_FAILURE_MARKER = "EXTRACTOR_FAILURE";

// Fails the first read of a document, like a container that has not finished starting.
export const EXTRACTOR_COLD_START_MARKER = "EXTRACTOR_COLD_START";

// The stand-in Sepomex knows only these postal codes and answers 500 for the unavailable one.
export const SEPOMEX_AREAS = {
  "01000": {
    state: "Ciudad de México",
    municipality: "Álvaro Obregón",
    suburbs: ["Centro", "San Ángel"],
  },
};

export const SEPOMEX_UNAVAILABLE_CODE = "00000";

// The stand-in Turnstile siteverify accepts only this token.
export const TURNSTILE_PASSING_TOKEN = "turnstile-pass";

const COMPATIBILITY_DATE = "2026-07-30";

const capturedMailSchema = z.object({
  from: z.string(),
  to: z.string(),
  subject: z.string(),
  html: z.string(),
  text: z.string(),
});

export type CapturedMail = z.infer<typeof capturedMailSchema>;

export type LocalApp = Awaited<ReturnType<typeof createLocalApp>>;

export async function createLocalApp() {
  const directory = await mkdtemp(path.join(tmpdir(), "horkos-e2e-"));
  let runtime: Miniflare | undefined;

  try {
    const entry = path.join(directory, "entry.mjs");
    const bundle = path.join(directory, "app.mjs");
    await writeFile(
      entry,
      `import app from ${JSON.stringify(path.resolve(webRoot, "dist/server/server.js"))};
import { workerHandlers } from ${JSON.stringify(path.resolve(webRoot, "src/worker-handlers.ts"))};
export default { fetch: (request, env, context) => app.fetch(request, env, context), ...workerHandlers };`
    );
    await build({
      entryPoints: [entry],
      outfile: bundle,
      bundle: true,
      format: "esm",
      platform: "node",
      conditions: ["workerd", "production"],
      target: "es2022",
      external: [
        "cloudflare:workers",
        "node:*",
        "tanstack-start-manifest:*",
        "#tanstack-*",
      ],
    });

    const options = {
      host: "127.0.0.1",
      port: 0,
      workers: [
        {
          name: "app",
          modulesRoot: directory,
          modules: [{ type: "ESModule", path: bundle }],
          compatibilityDate: COMPATIBILITY_DATE,
          compatibilityFlags: ["nodejs_compat"],
          assets: {
            directory: path.resolve(webRoot, "dist/client"),
            routerConfig: {
              has_user_worker: true,
              invoke_user_worker_ahead_of_assets: false,
            },
          },
          durableObjects: {
            EXTRACTOR: { className: "Extractor", scriptName: "extractor" },
          },
          d1Databases: { DB: "test-db" },
          r2Buckets: { DOCUMENTS: "documents" },
          queueProducers: { INVITATION_QUEUE: "invitation-emails" },
          queueConsumers: {
            "invitation-emails": {
              maxBatchSize: 10,
              maxConcurrency: 1,
              maxRetries: 5,
              retryDelay: 1,
              maxBatchTimeout: 1,
            },
          },
          serviceBindings: { EMAIL: { name: "mailer", entrypoint: "Mailer" } },
          // Every outbound fetch lands on the stand-in, so tests never reach the real catalog.
          outboundService: "sepomex",
          bindings: {
            SEPOMEX_URL: "https://sepomex.test",
            BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
            BETTER_AUTH_URL: "http://127.0.0.1",
            EMAIL_FROM: "Horkos Pruebas <verify@example.test>",
            TURNSTILE_SITE_KEY: "test-site-key",
            TURNSTILE_SECRET_KEY: "test-secret-key",
          },
        },
        {
          // Stands in for the container, which Miniflare cannot run: the "text" of a test PDF is
          // whatever follows its `%PDF-1.4` header line.
          name: "extractor",
          modules: true,
          script: `import { DurableObject } from "cloudflare:workers";
            const started = new Set();
            export class Extractor extends DurableObject {
              async fetch(request) {
                const body = await request.text();
                if (body.includes("${EXTRACTOR_FAILURE_MARKER}")) {
                  return new Response("boom", { status: 500 });
                }
                if (body.includes("${EXTRACTOR_COLD_START_MARKER}") && !started.has(body)) {
                  started.add(body);
                  return new Response("starting", { status: 503 });
                }
                const text = body.slice(body.indexOf("\\n") + 1).trim();
                return Response.json({ text: text || null });
              }
            }
            export default { fetch() { return new Response("ok"); } };`,
          compatibilityDate: COMPATIBILITY_DATE,
          durableObjects: { EXTRACTOR: "Extractor" },
        },
        {
          // Also answers Turnstile's siteverify, the only other outbound call.
          name: "sepomex",
          modules: true,
          script: `const areas = ${JSON.stringify(SEPOMEX_AREAS)};
            export default {
              async fetch(request) {
                const url = new URL(request.url);
                if (url.hostname === "challenges.cloudflare.com") {
                  const form = new URLSearchParams(await request.text());
                  return Response.json({ success: form.get("response") === "${TURNSTILE_PASSING_TOKEN}" });
                }
                const code = url.searchParams.get("zip_code");
                if (code === "${SEPOMEX_UNAVAILABLE_CODE}") {
                  return new Response("down", { status: 500 });
                }
                const area = areas[code];
                const zip_codes = (area?.suburbs ?? []).map((d_asenta) => ({
                  d_codigo: code, d_asenta, d_mnpio: area.municipality, d_estado: area.state,
                }));
                return Response.json({ zip_codes });
              },
            };`,
          compatibilityDate: COMPATIBILITY_DATE,
        },
        {
          name: "mailer",
          modules: true,
          script: `import { WorkerEntrypoint } from "cloudflare:workers";
            let sent = 0;
            export class Mailer extends WorkerEntrypoint {
              async send(message) {
                const ordinal = String(sent++).padStart(8, "0");
                if (await this.env.OUTBOX.get("fail")) throw new Error("test mail delivery failure");
                const id = crypto.randomUUID();
                const stamp = String(Date.now()).padStart(15, "0");
                await this.env.OUTBOX.put(stamp + "-" + ordinal + "-" + id, JSON.stringify(message));
                return { messageId: id };
              }
            }
            export default { fetch() { return new Response("ok"); } };`,
          compatibilityDate: COMPATIBILITY_DATE,
          kvNamespaces: { OUTBOX: "outbox" },
        },
      ],
    } satisfies MiniflareOptions;

    runtime = new Miniflare(options);
    const ready = await runtime.ready;
    const baseURL = ready.origin;
    options.port = Number(ready.port);
    // Auth must use the same origin as the owned ephemeral listener.
    const { workers } = options;

    workers[0].bindings = { ...workers[0].bindings, BETTER_AUTH_URL: baseURL };
    await runtime.setOptions(options);
    const db = await runtime.getD1Database("DB", "app");

    const migrationFolders = await readdir(migrationRoot);

    const folders = migrationFolders
      .filter((name) => /^\d{14}_/u.test(name))
      // oxlint-disable-next-line unicorn/no-array-sort -- Fresh array; TypeScript targets ES2022.
      .sort();

    const migrations = await Promise.all(
      folders.map((folder) =>
        readFile(path.join(migrationRoot, folder, "migration.sql"), "utf-8")
      )
    );

    for (const sql of migrations) {
      for (const statement of sql.split("--> statement-breakpoint")) {
        if (statement.trim()) {
          // oxlint-disable-next-line no-await-in-loop -- Schema statements depend on their predecessors.
          await db.prepare(statement).run();
        }
      }
    }

    await db
      .prepare(
        "INSERT INTO user (id, name, email, email_verified) VALUES (?, ?, ?, 1)"
      )
      .bind("verification-hr", "Verification HR", "verification-hr@example.com")
      .run();
    const documents = await runtime.getR2Bucket("DOCUMENTS", "app");
    const outbox = await runtime.getKVNamespace("OUTBOX", "mailer");
    const ownedRuntime = runtime;

    return {
      baseURL,
      db,
      async listObjects() {
        const listed = await documents.list();

        return listed.objects.map(({ key }) => key);
      },
      async getObject(key: string) {
        const object = await documents.get(key);

        if (!object) {
          return null;
        }

        return {
          bytes: new Uint8Array(await object.arrayBuffer()),
          contentType: object.httpMetadata?.contentType,
        };
      },
      async getMail() {
        const messages: CapturedMail[] = [];

        const records = await outbox.list();
        const captured = records.keys.filter((key) => key.name !== "fail");

        const stored = await Promise.all(
          captured.map(async (key) => {
            const message = await outbox.get(key.name);

            return message
              ? capturedMailSchema.parse(JSON.parse(message))
              : null;
          })
        );

        for (const message of stored) {
          if (message) {
            messages.push(message);
          }
        }

        return messages;
      },
      async runScheduled() {
        const worker = await ownedRuntime.getWorker("app");
        const result = await worker.scheduled({ cron: "* * * * *" });

        return result.outcome;
      },
      async failDelivery(fail: boolean) {
        await (fail ? outbox.put("fail", "true") : outbox.delete("fail"));
      },
      async close() {
        try {
          await ownedRuntime.dispose();
        } finally {
          await rm(directory, { recursive: true, force: true });
        }
      },
    };
  } catch (error) {
    try {
      await runtime?.dispose();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }

    throw error;
  }
}
