import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

import { publicErrorsMiddleware } from "@/middleware/public-errors";

// Defining a start instance turns off Start's default CSRF check, so it is declared here.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
  functionMiddleware: [publicErrorsMiddleware],
}));
