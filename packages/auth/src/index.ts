import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { Database } from "@horkos/db";
import * as schema from "@horkos/db/schema/auth";
import { betterAuth } from "better-auth";
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
    plugins: [
      magicLink({
        disableSignUp: true,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => {
          const existingUser = await database.query.user.findFirst({
            columns: { id: true },
            where: { email: email.toLowerCase() },
          });

          if (existingUser) {
            await sendMagicLink({ email, url });
          }
        },
      }),
      tanstackStartCookies(),
    ],
  });
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
