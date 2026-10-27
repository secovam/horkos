import { existsSync } from "node:fs";

import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import "varlock/auto-load";

import type { Extractor } from "../../apps/web/src/extractor.ts";

const isDev = process.env.ALCHEMY_DEV === "true";

const employeesSeed = "../../packages/db/seed/employees.sql";

export const db = Cloudflare.D1.Database("database", {
  migrations: "../../packages/db/src/migrations",
  // Seed only local dev; production gets no seed data
  importFiles: isDev
    ? [
        "../../packages/db/seed/dev.sql",
        ...(existsSync(employeesSeed) ? [employeesSeed] : []),
      ]
    : [],
});

// Private on purpose: no custom domain and `publicAccess` stays off, so objects are reachable only through the Worker binding.
export const documents = Cloudflare.R2.Bucket("documents");

export const invitationQueue = Cloudflare.Queues.Queue("invitation-emails");

// Reachable only through the `EXTRACTOR` Durable Object binding: the container has no public URL.
// The `Extractor` class starts it, picking the image and instance size (apps/web/src/extractor.ts).
export const extractor = Cloudflare.Container("extractor", {
  schedulingPolicy: "durable_object",
  context: `${import.meta.dirname}/../../apps/extractor`,
});

// Per stage: deployed stages set WEB_DOMAIN; dev keeps its portless URL. Unset leaves workers.dev.
const webDomain = isDev ? undefined : process.env.WEB_DOMAIN || undefined;

// A public domain gets its own Turnstile widget; elsewhere `.env.schema` holds Cloudflare's always-passing test keys.
const turnstileKeys = webDomain
  ? Cloudflare.Turnstile.Widget("turnstile", {
      domains: [webDomain],
      mode: "managed",
    }).pipe(
      Effect.map((widget) => ({
        TURNSTILE_SITE_KEY: widget.sitekey,
        TURNSTILE_SECRET_KEY: widget.secret,
      }))
    )
  : Effect.succeed({
      TURNSTILE_SITE_KEY: Config.String("TURNSTILE_SITE_KEY"),
      TURNSTILE_SECRET_KEY: Config.Redacted("TURNSTILE_SECRET_KEY"),
    });

export const web = Cloudflare.Website.Vite(
  "web",
  Effect.gen(function* () {
    return {
      rootDir: "../../apps/web",
      main: "src/worker.ts",
      domain: webDomain,
      compatibility: {
        flags: ["nodejs_compat"],
      },
      env: {
        DB: db,
        DOCUMENTS: documents,
        INVITATION_QUEUE: invitationQueue,
        EXTRACTOR: Cloudflare.DurableObject<Extractor>("Extractor", {
          containers: [extractor],
        }),
        EMAIL: Cloudflare.Email.SendEmail("EMAIL"),
        EMAIL_FROM: Config.String("EMAIL_FROM"),
        SEPOMEX_URL: Config.String("SEPOMEX_URL"),
        ...(yield* turnstileKeys),
        BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
        // portless sets PORTLESS_URL only under `pnpm dev`; auth origins must match it
        BETTER_AUTH_URL: process.env.PORTLESS_URL ?? Cloudflare.Worker.URL,
      },
      // Every minute the scheduled handler moves a batch of queued invitations onto the queue.
      crons: ["* * * * *"],
      dev: {
        port: Number(process.env.PORT ?? 3001),
      },
    };
  })
);

export type WebEnv = Cloudflare.InferEnv<typeof web>;

export default Alchemy.Stack(
  "horkos",
  {
    providers: Cloudflare.providers(),
    state: isDev ? Alchemy.localState() : Cloudflare.state(),
  },
  Effect.gen(function* () {
    const webWorker = yield* web;
    const queue = yield* invitationQueue;
    const database = yield* db;

    // Throttled on purpose: one batch of 10 at a time keeps email sending under provider limits.
    yield* Cloudflare.Queues.Consumer("invitation-emails-consumer", {
      queueId: queue.queueId,
      scriptName: webWorker.workerName,
      settings: {
        batchSize: 10,
        maxConcurrency: 1,
        maxRetries: 5,
        retryDelay: 60,
      },
    });

    return {
      web: webWorker.url,
      databaseName: database.databaseName,
    };
  })
);
