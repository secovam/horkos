import { render, toPlainText } from "react-email";
import { z } from "zod";

import { InvitationEmail } from "@/emails/invitation";
import { MagicLinkEmail } from "@/emails/magic-link";

export async function renderMagicLinkEmail(url: string) {
  const html = await render(<MagicLinkEmail url={url} />);

  return { html, text: toPlainText(html) };
}

const sendErrorSchema = z.object({
  code: z.string().optional(),
  message: z.string(),
});

export async function sendMagicLinkEmail(
  binding: Env["EMAIL"],
  from: string,
  { email, url }: { email: string; url: string }
) {
  const { html, text } = await renderMagicLinkEmail(url);

  try {
    await binding.send({
      from,
      to: email,
      subject: "Tu enlace para ingresar a Horkos",
      html,
      text,
    });
  } catch (error) {
    // Better Auth swallows the cause into a bare 500; the binding's code says why sending failed.
    const parsed = sendErrorSchema.safeParse(error);

    // Email addresses are dropped: the binding echoes sender and recipient in its messages.
    const message = parsed.success
      ? parsed.data.message
          .split(" ")
          .map((word) => (word.includes("@") ? "<email>" : word))
          .join(" ")
      : "unknown";

    console.error(
      "magic link email failed",
      parsed.data?.code ?? "no_code",
      message
    );
    throw error;
  }
}

export async function sendInvitationEmail(
  binding: Env["EMAIL"],
  from: string,
  {
    email,
    employeeName,
    url,
  }: { email: string; employeeName: string; url: string }
) {
  const html = await render(
    <InvitationEmail employeeName={employeeName} url={url} />
  );

  await binding.send({
    from,
    to: email,
    subject: "Completa tus datos para tu contrato",
    html,
    text: toPlainText(html),
  });
}
