import { z } from "zod";

import { newInvitationSchema } from "./invitation";

export const REGISTRATIONS_PAGE_SIZE = 10;

/* oxlint-disable promise/prefer-await-to-then, github/no-then -- Zod .catch(), not a Promise. */
export const registrationSearchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
});
/* oxlint-enable promise/prefer-await-to-then, github/no-then */

export const listRegistrationsSchema = registrationSearchSchema.extend({
  q: z.string().max(200),
});

export const publicRegistrationSchema = newInvitationSchema.extend({
  turnstileToken: z.string().min(1, "Completa la verificación").max(2048),
});

export const updateRegistrationSchema = newInvitationSchema.extend({
  id: z.string().min(1),
});
