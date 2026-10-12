import { existsSync } from "node:fs";

import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
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
export const extractor = Cloudflare.Container<Extractor>("extractor", {
  context: `${import.meta.dirname}/../../apps/extractor`,
  className: "Extractor",
  instanceType: "basic",
  maxInstances: 3,
});

export const web = Cloudflare.Website.Vite("web", {
  rootDir: "../../apps/web",
  main: "src/worker.ts",
  compatibility: {
    flags: ["nodejs_compat"],
  },
  env: {
    DB: db,
    DOCUMENTS: documents,
    INVITATION_QUEUE: invitationQueue,
    EXTRACTOR: extractor,
    EMAIL: Cloudflare.Email.SendEmail("EMAIL"),
    EMAIL_FROM: Config.String("EMAIL_FROM"),
    BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
    // portless sets PORTLESS_URL only under `pnpm dev`; auth origins must match it
    BETTER_AUTH_URL: process.env.PORTLESS_URL ?? Cloudflare.Worker.URL,
  },
  // Every minute the scheduled handler moves a batch of queued invitations onto the queue.
  crons: ["* * * * *"],
  dev: {
    port: Number(process.env.PORT ?? 3001),
  },
});

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
