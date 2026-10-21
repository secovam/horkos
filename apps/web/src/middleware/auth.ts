import { createMiddleware } from "@tanstack/react-start";

import { PublicError } from "@/lib/public-error";

import { createAuth } from "../services";

export const authMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const auth = await createAuth();

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    return next({
      context: { session },
    });
  }
);

export const requireSessionMiddleware = createMiddleware()
  .middleware([authMiddleware])
  .server(({ next, context }) => {
    if (!context.session) {
      throw new PublicError("No autorizado");
    }

    return next({ context: { session: context.session } });
  });
