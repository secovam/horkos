import { createAuth as createConfiguredAuth } from "@horkos/auth";
import { createDb } from "@horkos/db";
import type { Database } from "@horkos/db";

import { ENV } from "./env.server";
import { sendMagicLinkEmail } from "./services/email";

export function getDb(): Database {
  return createDb(ENV);
}

export async function createAuth(database?: Database) {
  return createConfiguredAuth(
    ENV,
    database ?? (await getDb()),
    ({ email, url }) =>
      sendMagicLinkEmail(ENV.EMAIL, ENV.EMAIL_FROM, { email, url })
  );
}
