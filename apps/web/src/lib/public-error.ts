// A message written for the person using Horkos. Any other error reaching a server function's
// caller is replaced, since database and library messages can quote the personal data being handled.
export class PublicError extends Error {
  override name = "PublicError";
}

export const GENERIC_ERROR_MESSAGE = "Algo salió mal. Intenta de nuevo.";

export function toPublicError(error: Error) {
  return error instanceof PublicError
    ? error
    : new PublicError(GENERIC_ERROR_MESSAGE);
}
