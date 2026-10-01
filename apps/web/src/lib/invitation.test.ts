import { describe, expect, test } from "vitest";

import {
  escapeLikePattern,
  generateInvitationToken,
  hashInvitationToken,
  invitationStatus,
} from "./invitation";

const at = new Date("2026-01-15T10:00:00Z");

describe("invitationStatus", () => {
  test("revocation wins over submission", () => {
    expect(invitationStatus({ revokedAt: at, submittedAt: at })).toBe(
      "revoked"
    );
  });

  test("a submitted invitation that was not revoked is submitted", () => {
    expect(invitationStatus({ revokedAt: null, submittedAt: at })).toBe(
      "submitted"
    );
  });

  test("an untouched invitation is pending", () => {
    expect(invitationStatus({ revokedAt: null, submittedAt: null })).toBe(
      "pending"
    );
  });
});

describe("invitation tokens", () => {
  test("hash is the SHA-256 hex digest", async () => {
    expect(await hashInvitationToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  test("tokens are 256-bit hex and never repeat", () => {
    const first = generateInvitationToken();

    expect(first).toMatch(/^[0-9a-f]{64}$/u);
    expect(generateInvitationToken()).not.toBe(first);
  });
});

test("LIKE wildcards are escaped so they match literally", () => {
  expect(escapeLikePattern(String.raw`50%_off\x`)).toBe(
    String.raw`50\%\_off\\x`
  );
});
