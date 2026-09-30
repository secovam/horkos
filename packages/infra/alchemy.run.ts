import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import * as Output from "alchemy/Output";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import "varlock/auto-load";

export const db = Cloudflare.D1.Database("database", {
  migrations: "../../packages/db/src/migrations",
});

export const web = Cloudflare.Website.Vite("web", {
  rootDir: "../../apps/web",
  compatibility: {
    flags: ["nodejs_compat"],
  },
  env: {
    DB: db,
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
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const webWorker = yield* web;

    // Undefined outside GitHub Actions, so local dev needs no GitHub token
    const github = yield* GitHub.GitHubEnv;
    if (github?.pr) {
      yield* GitHub.Comment("preview-comment", {
        owner: github.owner,
        repository: github.repository,
        issueNumber: github.pr,
        body: Output.interpolate`**Preview deployed**

${webWorker.url}

Commit \`${github.sha.slice(0, 7)}\`. This comment updates on each push.`,
      });
    }

    return {
      web: webWorker.url,
    };
  })
);
