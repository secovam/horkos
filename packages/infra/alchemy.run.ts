import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import "varlock/auto-load";

const isDev = process.env.ALCHEMY_DEV === "true";

export const db = Cloudflare.D1.Database("database", {
  migrations: "../../packages/db/src/migrations",
  // Seed only local dev; production gets no seed data
  importFiles: isDev ? ["../../packages/db/seed/dev.sql"] : [],
});

export const web = Cloudflare.Website.Vite("web", {
  rootDir: "../../apps/web",
  compatibility: {
    flags: ["nodejs_compat"],
  },
  env: {
    DB: db,
    EMAIL: Cloudflare.Email.SendEmail("EMAIL"),
    EMAIL_FROM: Config.String("EMAIL_FROM"),
    BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
    // portless sets PORTLESS_URL only under `pnpm dev`; auth origins must match it
    BETTER_AUTH_URL: process.env.PORTLESS_URL ?? Cloudflare.Worker.URL,
  },
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

    return {
      web: webWorker.url,
    };
  })
);
