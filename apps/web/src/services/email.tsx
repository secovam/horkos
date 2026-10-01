import { render, toPlainText } from "react-email";

import { MagicLinkEmail } from "@/emails/magic-link";

export async function renderMagicLinkEmail(url: string) {
  const html = await render(<MagicLinkEmail url={url} />);

  return { html, text: toPlainText(html) };
}

export async function sendMagicLinkEmail(
  binding: Env["EMAIL"],
  from: string,
  { email, url }: { email: string; url: string }
) {
  const { html, text } = await renderMagicLinkEmail(url);

  await binding.send({
    from,
    to: email,
    subject: "Tu enlace para ingresar a Horkos",
    html,
    text,
  });
}
