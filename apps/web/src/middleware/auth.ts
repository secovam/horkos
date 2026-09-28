import { createMiddleware } from "@tanstack/react-start";

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
