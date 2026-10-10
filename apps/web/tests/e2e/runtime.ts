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
      `export { default } from ${JSON.stringify(path.resolve(webRoot, "dist/server/server.js"))};`
    );
    await build({
      entryPoints: [entry],
      outfile: bundle,
      bundle: true,
      format: "esm",
      platform: "node",
      conditions: ["workerd", "production"],
      target: "es2022",
      external: ["cloudflare:workers", "node:*"],
    });

    const options = {
      host: "127.0.0.1",
      port: 0,
      workers: [
        {
          name: "app",
          modulesRoot: directory,
          modules: [{ type: "ESModule", path: bundle }],
          compatibilityDate: "2026-07-30",
          compatibilityFlags: ["nodejs_compat"],
          assets: {
            directory: path.resolve(webRoot, "dist/client"),
            routerConfig: {
              has_user_worker: true,
              invoke_user_worker_ahead_of_assets: false,
            },
          },
          d1Databases: { DB: "test-db" },
          serviceBindings: { EMAIL: { name: "mailer", entrypoint: "Mailer" } },
          bindings: {
            BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
            BETTER_AUTH_URL: "http://127.0.0.1",
            EMAIL_FROM: "Horkos Pruebas <verify@example.test>",
          },
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
          compatibilityDate: "2026-07-30",
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
    const outbox = await runtime.getKVNamespace("OUTBOX", "mailer");
    const ownedRuntime = runtime;

    return {
      baseURL,
      db,
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
