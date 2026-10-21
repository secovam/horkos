import { isNotFound, isRedirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";

import { PublicError, toPublicError } from "@/lib/public-error";

export const publicErrorsMiddleware = createMiddleware({
  type: "function",
}).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (isRedirect(error) || isNotFound(error)) {
      throw error;
    }

    const thrown =
      error instanceof Error ? error : new Error("non_error_thrown");

    if (!(thrown instanceof PublicError)) {
      // Only the type: the message can quote the values being written.
      console.error("server function failed", thrown.name);
    }

    throw toPublicError(thrown);
  }
});
