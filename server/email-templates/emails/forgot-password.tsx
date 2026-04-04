import * as React from "react";
import { Img, Link, Section, Text } from "@react-email/components";

import ChartbrewLayout from "./components/chartbrew-layout";

export type ForgotPasswordEmailProps = {
  resetUrl: string;
  browserUrl?: string;
  appName?: string;
  logoUrl?: string;
  supportEmail?: string;
};

export const DEFAULT_FORGOT_PASSWORD_EMAIL_PROPS = {
  appName: "Chartbrew",
  logoUrl: "https://cdn2.chartbrew.com/logos/logo-light.png",
  supportEmail: "support@chartbrew.com",
} as const;

export default function ForgotPasswordEmail(props: ForgotPasswordEmailProps) {
  const appName = props.appName ?? DEFAULT_FORGOT_PASSWORD_EMAIL_PROPS.appName;
  const logoUrl = props.logoUrl ?? DEFAULT_FORGOT_PASSWORD_EMAIL_PROPS.logoUrl;
  const supportEmail = props.supportEmail ?? DEFAULT_FORGOT_PASSWORD_EMAIL_PROPS.supportEmail;

  return (
    <ChartbrewLayout
      previewText="Forgot your password? Use the link in this email to reset it."
    >
      <Section>
        <Img src={logoUrl} alt={`${appName} logo`} width="200" style={styles.logo} />

        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.bodyCopy}>
          You can use the link below to reset to a new one. If you didn&apos;t request this password reset
          email, please ignore and do not click the link.
        </Text>
        <Text style={styles.resetWrap}>
          <Link href={props.resetUrl} style={styles.resetLink}>
            Click to reset password
          </Link>
        </Text>
        <Text style={styles.bodyCopy}>
          Thank you,
          <br />
          The {appName} team
        </Text>
      </Section>

      <hr style={styles.hr} />

      <Section>
        <Text style={styles.footerCopy}>
          If you received this email by mistake or error, please{" "}
          <Link href={`mailto:${supportEmail}`} style={styles.supportLink}>
            contact support
          </Link>{" "}
          and we can investigate it for you. We take security and spam very seriously.
        </Text>
        <Text style={styles.footerMeta}>
          {appName} ·{" "}
          <Link href={`mailto:${supportEmail}`} style={styles.footerMetaLink}>
            {supportEmail}
          </Link>
          {" · Depomo Ltd, 5 South Charlotte St, Edinburgh, UK"}
        </Text>
      </Section>
    </ChartbrewLayout>
  );
}

type PreviewableEmail = typeof ForgotPasswordEmail & {
  PreviewProps?: ForgotPasswordEmailProps;
};

(ForgotPasswordEmail as PreviewableEmail).PreviewProps = {
  resetUrl: "https://app.chartbrew.com/reset-password?token=preview-token-123",
};

const styles = {
  logo: {
    marginBottom: "28px",
    display: "block",
  },
  title: {
    margin: "0 0 28px",
    fontSize: "24px",
    lineHeight: "1.25",
    fontWeight: "700",
    color: "#030712",
  },
  bodyCopy: {
    margin: "0 0 24px",
    fontSize: "16px",
    lineHeight: "1.6",
    color: "#4b5563",
  },
  resetWrap: {
    margin: "0 0 26px",
  },
  resetLink: {
    color: "#4b8fcc",
    textDecoration: "underline",
    fontSize: "16px",
    lineHeight: "1.4",
  },
  footerCopy: {
    margin: "0 0 24px",
    fontSize: "14px",
    lineHeight: "1.7",
    color: "#6b7280",
  },
  supportLink: {
    color: "#111827",
    textDecoration: "underline",
  },
  footerMeta: {
    margin: "0",
    fontSize: "14px",
    lineHeight: "1.7",
    color: "#6b7280",
  },
  footerMetaLink: {
    color: "#6b7280",
    textDecoration: "none",
  },
  hr: {
    border: "none",
    borderTop: "1px solid #e5e7eb",
    margin: "20px 0",
  },
};
