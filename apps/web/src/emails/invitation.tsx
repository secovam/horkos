import { EmailLayout, EmailText } from "@/emails/email-layout";

export function InvitationEmail({
  employeeName,
  url,
}: {
  employeeName: string;
  url: string;
}) {
  return (
    <EmailLayout
      actionLabel="Completar mis datos"
      greeting={`¡Hola, ${employeeName}!`}
      notice="Este enlace es personal. No lo compartas. Si recibes un correo más reciente, usa el enlace nuevo."
      preview="Completa tus datos para tu contrato"
      url={url}
    >
      <EmailText>
        Recursos Humanos te invita a subir tus documentos y completar tus datos
        para preparar tu contrato.
      </EmailText>
      <EmailText>
        Ten a la mano tus 3 documentos en PDF: constancia de situación fiscal,
        constancia del IMSS y un recibo de luz de CFE o de teléfono de Telmex
        como comprobante de domicilio.
      </EmailText>
      <EmailText>
        No necesitas crear una cuenta y puedes hacerlo desde tu teléfono.
      </EmailText>
    </EmailLayout>
  );
}
