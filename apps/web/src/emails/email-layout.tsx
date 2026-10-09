/* oxlint-disable shadcn/no-inline-styles -- Email clients require inline styles. */
import type { ReactNode } from "react";
import {
  Body,
  Button,
  Container,
  Font,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";

const colors = {
  primary: "#2563EB",
  bg: "#F3F4F6",
  cardBg: "#FFFFFF",
  text: {
    primary: "#1F2937",
    secondary: "#6B7280",
    muted: "#9CA3AF",
  },
  border: "#E5E7EB",
};

const main = {
  backgroundColor: colors.bg,
  fontFamily:
    '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  WebkitFontSmoothing: "antialiased",
  margin: 0,
  padding: "40px 0",
} as const;

const container = {
  backgroundColor: "transparent",
  maxWidth: "480px",
  margin: "0 auto",
};

const card = {
  backgroundColor: colors.cardBg,
  borderRadius: "16px",
  padding: "40px 32px",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05), 0 5px 15px rgba(0, 0, 0, 0.08)",
  marginBottom: "24px",
};

const logoContainer = {
  textAlign: "center",
  marginBottom: "24px",
} as const;

const logo = {
  display: "block",
  margin: "0 auto",
  maxWidth: "200px",
  height: "auto",
};

const greetingText = {
  color: colors.text.primary,
  fontSize: "18px",
  fontWeight: "600",
  margin: "0 0 16px 0",
  lineHeight: "28px",
};

const text = {
  color: colors.text.secondary,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px 0",
};

const buttonContainer = {
  textAlign: "center",
  margin: "32px 0 24px 0",
} as const;

const button = {
  backgroundColor: colors.primary,
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center",
  display: "block",
  padding: "14px 32px",
  margin: "0 auto",
} as const;

const fallbackSection = {
  borderTop: `1px solid ${colors.border}`,
  paddingTop: "24px",
  marginTop: "24px",
};

const fallbackTitle = {
  color: colors.text.primary,
  fontSize: "14px",
  fontWeight: "600",
  margin: "0 0 8px 0",
};

const fallbackText = {
  color: colors.text.secondary,
  fontSize: "13px",
  margin: "0 0 12px 0",
  lineHeight: "20px",
};

const linkBox = {
  backgroundColor: colors.bg,
  borderRadius: "8px",
  padding: "12px",
  textAlign: "center",
} as const;

const fallbackLink = {
  color: colors.primary,
  fontSize: "12px",
  textDecoration: "none",
  wordBreak: "break-all",
  fontWeight: "500",
} as const;

const noticeSection = {
  textAlign: "center",
  padding: "16px 0",
} as const;

const noticeText = {
  color: colors.text.secondary,
  fontSize: "13px",
  lineHeight: "20px",
  margin: 0,
  textAlign: "center",
} as const;

const footer = {
  textAlign: "center",
  paddingTop: "24px",
} as const;

const footerText = {
  color: colors.text.muted,
  fontSize: "12px",
  margin: "0 0 8px 0",
  textAlign: "center",
} as const;

const footerBrand = {
  color: colors.text.secondary,
  fontSize: "14px",
  fontWeight: "600",
  margin: "0 0 4px 0",
  textAlign: "center",
} as const;

export function EmailLayout({
  preview,
  greeting,
  children,
  actionLabel,
  url,
  notice,
}: {
  preview: string;
  greeting: string;
  children: ReactNode;
  actionLabel: string;
  url: string;
  notice: string;
}) {
  return (
    <Html lang="es">
      <Head>
        <Font
          fallbackFontFamily="sans-serif"
          fontFamily="Inter"
          fontStyle="normal"
          fontWeight={400}
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff2",
            format: "woff2",
          }}
        />
        <Font
          fallbackFontFamily="sans-serif"
          fontFamily="Inter"
          fontStyle="normal"
          fontWeight={600}
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hjp-Ek-_EeA.woff2",
            format: "woff2",
          }}
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Section style={logoContainer}>
              <Img
                alt="Grupo Secovam"
                src={new URL("/logo-secovam.png", url).href}
                style={logo}
                width={200}
              />
            </Section>

            <Text style={greetingText}>{greeting}</Text>

            {children}

            <Section style={buttonContainer}>
              <Button href={url} style={button}>
                {actionLabel}
              </Button>
            </Section>

            <Section style={fallbackSection}>
              <Text style={fallbackTitle}>¿El botón no funciona?</Text>
              <Text style={fallbackText}>
                Copia y pega este enlace en tu navegador:
              </Text>
              <Section style={linkBox}>
                <Link href={url} style={fallbackLink}>
                  {url}
                </Link>
              </Section>
            </Section>
          </Section>

          <Section style={noticeSection}>
            <Text style={noticeText}>{notice}</Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              Este es un correo automático, por favor no respondas.
            </Text>
            <Text style={footerBrand}>Grupo Secovam</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailText({ children }: { children: ReactNode }) {
  return <Text style={text}>{children}</Text>;
}
