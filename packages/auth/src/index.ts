import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { Database } from "@horkos/db";
import * as schema from "@horkos/db/schema/auth";
import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { magicLink } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export interface AuthConfig {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
}

export interface MagicLinkMessage {
  email: string;
  url: string;
}

export type SendMagicLink = (message: MagicLinkMessage) => Promise<void>;

export function createAuth(
  env: AuthConfig,
  database: Database,
  sendMagicLink: SendMagicLink
) {
  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema,
    }),
    trustedOrigins: [env.BETTER_AUTH_URL],
    emailAndPassword: { enabled: false },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    logger: {
      // Better Auth's default errors include database parameters such as emails and verification data.
      log(level) {
        if (level === "error") {
          console.error("[Better Auth] error");
        } else if (level === "warn") {
          console.warn("[Better Auth] warn");
        } else {
          console.info(`[Better Auth] ${level}`);
        }
      },
    },
    hooks: {
      // Unknown addresses get the same response as known ones, but must not
      // reach the plugin, which stores a verification row before sending.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/magic-link") {
          return;
        }

        const existingUser = await database.query.user.findFirst({
          columns: { id: true },
          where: { email: String(ctx.body?.email).toLowerCase() },
        });

        if (!existingUser) {
          return ctx.json({ status: true });
        }
      }),
    },
    plugins: [
      magicLink({
        disableSignUp: true,
        storeToken: "hashed",
        sendMagicLink: ({ email, url }) => sendMagicLink({ email, url }),
      }),
      tanstackStartCookies(),
    ],
  });
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
