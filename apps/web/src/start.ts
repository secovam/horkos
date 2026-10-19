import { createStart } from "@tanstack/react-start";

import { publicErrorsMiddleware } from "@/middleware/public-errors";

export const startInstance = createStart(() => ({
  functionMiddleware: [publicErrorsMiddleware],
}));
