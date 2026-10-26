import { z } from "zod";

import { ENV } from "@/env.server";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const TURNSTILE_TIMEOUT_MS = 5000;

const siteverifySchema = z.object({ success: z.boolean() });

// Any failure, including Cloudflare being unreachable, counts as not verified.
export async function verifyTurnstile(token: string) {
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({
        secret: ENV.TURNSTILE_SECRET_KEY,
        response: token,
      }),
      signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
    });

    return siteverifySchema.parse(await response.json()).success;
  } catch {
    return false;
  }
}
