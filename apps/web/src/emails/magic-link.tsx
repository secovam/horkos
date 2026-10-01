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
export function MagicLinkEmail({ url }: { url: string }) {
  return (
    <Html lang="es">
      <Head />
      <Preview>Tu enlace para ingresar a Horkos</Preview>
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
          <Heading style={{ fontSize: 24 }}>Ingresa a Horkos</Heading>
          <Text>
            Usa este enlace para iniciar sesión. Solo se puede usar una vez.
          </Text>
          <Button
            href={url}
            style={{
              backgroundColor: "#111827",
              color: "#ffffff",
              padding: "12px 20px",
            }}
          >
            Iniciar sesión
          </Button>
          <Text>Si no solicitaste este correo, puedes ignorarlo.</Text>
        </Container>
      </Body>
    </Html>
  );
}
