import { describe, expect, test } from "vitest";

import {
  GENERIC_ERROR_MESSAGE,
  PublicError,
  toPublicError,
} from "./public-error";

describe("toPublicError", () => {
  test("keeps a message written for the user", () => {
    const error = new PublicError("Sube el alta del IMSS.");

    expect(toPublicError(error)).toBe(error);
  });

  test("replaces a database error that quotes personal data", () => {
    const leaked = toPublicError(
      new Error(
        "Failed query: insert ... params: ana@example.com,XAXX010101AB1"
      )
    );

    expect(leaked).toBeInstanceOf(PublicError);
    expect(leaked.message).toBe(GENERIC_ERROR_MESSAGE);
    expect(leaked.message).not.toContain("ana@example.com");
  });
});
