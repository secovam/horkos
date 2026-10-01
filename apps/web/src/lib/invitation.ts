import type { Badge } from "@horkos/ui/components/badge";
import type { ComponentProps } from "react";
import { z } from "zod";

export type InvitationStatus = "revoked" | "submitted" | "pending";

export function invitationStatus(invitation: {
  revokedAt: Date | null;
  submittedAt: Date | null;
}): InvitationStatus {
  if (invitation.revokedAt) {
    return "revoked";
  }

  if (invitation.submittedAt) {
    return "submitted";
  }

  return "pending";
}

export const INVITATION_STATUS = {
  pending: { label: "Pendiente", variant: "outline" },
  submitted: { label: "Recibida", variant: "default" },
  revoked: { label: "Revocada", variant: "destructive" },
} as const satisfies Record<
  InvitationStatus,
  { label: string; variant: ComponentProps<typeof Badge>["variant"] }
>;

export const INVITATIONS_PAGE_SIZE = 10;

/* oxlint-disable promise/prefer-await-to-then, github/no-then -- Zod .catch(), not a Promise. */
export const invitationSearchSchema = z.object({
  tab: z.enum(["active", "revoked"]).default("active").catch("active"),
  q: z.string().max(200).default("").catch(""),
  page: z.number().int().min(1).default(1).catch(1),
});
/* oxlint-enable promise/prefer-await-to-then, github/no-then */

export type InvitationTab = z.infer<typeof invitationSearchSchema>["tab"];

export const INVITATION_TABS = [
  { value: "active", label: "Activas" },
  { value: "revoked", label: "Revocadas" },
] as const satisfies { value: InvitationTab; label: string }[];

export const newInvitationSchema = z.object({
  employeeName: z.string().trim().min(1, "Ingresa el nombre del empleado"),
  email: z.email("Ingresa un correo válido").trim().toLowerCase(),
});

const TOKEN_BYTES = 32;

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

export function generateInvitationToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

export async function hashInvitationToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );

  return toHex(new Uint8Array(digest));
}

export function escapeLikePattern(value: string) {
  return value.replaceAll(/[\\%_]/gu, (char) => `\\${char}`);
}
