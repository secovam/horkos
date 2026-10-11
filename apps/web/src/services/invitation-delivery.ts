import { ENV } from "@/env.server";
import { sendInvitationEmail } from "@/services/email";

export function deliverInvitation(
  token: string,
  { email, employeeName }: { email: string; employeeName: string }
) {
  return sendInvitationEmail(ENV.EMAIL, ENV.EMAIL_FROM, {
    email,
    employeeName,
    url: `${ENV.BETTER_AUTH_URL}/invitacion/${token}`,
  });
}
