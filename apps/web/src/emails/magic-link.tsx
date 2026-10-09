import { EmailLayout, EmailText } from "@/emails/email-layout";

export function MagicLinkEmail({ url }: { url: string }) {
  return (
    <EmailLayout
      actionLabel="Iniciar sesión"
      greeting="¡Hola!"
      notice="Si no solicitaste este correo, puedes ignorarlo de forma segura. Tu cuenta sigue protegida."
      preview="Tu enlace para ingresar a Horkos"
      url={url}
    >
      <EmailText>
        Recibiste este enlace porque solicitaste ingresar a tu cuenta en Horkos.
      </EmailText>
      <EmailText>
        Este enlace es seguro y <strong>solo se puede usar una vez</strong>.
      </EmailText>
    </EmailLayout>
  );
}
