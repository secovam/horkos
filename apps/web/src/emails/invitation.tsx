import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "react-email";

/* oxlint-disable shadcn/no-inline-styles -- Email clients require inline styles. */
export function InvitationEmail({
  employeeName,
  url,
}: {
  employeeName: string;
  url: string;
}) {
  return (
    <Html lang="es">
      <Head />
      <Preview>Completa tus datos para tu contrato</Preview>
      <Body
        style={{ backgroundColor: "#f5f5f5", fontFamily: "Arial, sans-serif" }}
      >
        <Container
          style={{
            margin: "32px auto",
            padding: 24,
            backgroundColor: "#ffffff",
          }}
        >
          <Heading style={{ fontSize: 24 }}>Hola, {employeeName}</Heading>
          <Text>
            Recursos Humanos te invita a subir tus documentos y completar tus
            datos para preparar tu contrato. No necesitas crear una cuenta y
            puedes hacerlo desde tu teléfono.
          </Text>
          <Button
            href={url}
            style={{
              backgroundColor: "#111827",
              color: "#ffffff",
              padding: "12px 20px",
            }}
          >
            Completar mis datos
          </Button>
          <Text>
            Este enlace es personal. No lo compartas. Si recibes un correo más
            reciente, usa el enlace nuevo.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
