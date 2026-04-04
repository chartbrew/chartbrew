import * as React from "react";
import {
  Button, Img, Link, Section, Text
} from "@react-email/components";

import ChartbrewLayout from "./components/chartbrew-layout";

export type EmailUpdateEmailProps = {
  updateUrl: string;
  browserUrl?: string;
  appName?: string;
  logoUrl?: string;
  supportEmail?: string;
};

export const DEFAULT_EMAIL_UPDATE_EMAIL_PROPS = {
  appName: "Chartbrew",
  logoUrl: "https://cdn2.chartbrew.com/logos/cb_logo_light.svg",
  supportEmail: "support@chartbrew.com",
} as const;

export default function EmailUpdateEmail(props: EmailUpdateEmailProps) {
  const appName = props.appName ?? DEFAULT_EMAIL_UPDATE_EMAIL_PROPS.appName;
  const logoUrl = props.logoUrl ?? DEFAULT_EMAIL_UPDATE_EMAIL_PROPS.logoUrl;
  const supportEmail = props.supportEmail ?? DEFAULT_EMAIL_UPDATE_EMAIL_PROPS.supportEmail;

  return (
    <ChartbrewLayout
      previewText="Confirm your new email address to finish updating your Chartbrew account."
      browserUrl={props.browserUrl}
    >
      <Section>
        <Img src={logoUrl} alt={`${appName} logo`} width="200" style={styles.logo} />

        <Text style={styles.eyebrow}>Account security</Text>
        <Text style={styles.title}>Confirm your new email address</Text>
        <Text style={styles.bodyCopy}>
          We received a request to update the email address on your {appName} account. Confirm it below to finish
          the change.
        </Text>

        <Section style={styles.panel}>
          <Text style={styles.panelTitle}>What happens next</Text>
          <Text style={styles.panelCopy}>Once confirmed, this email address will become the new login for your account.</Text>
          <Text style={styles.panelCopy}>For security, this verification link expires in 3 hours.</Text>
        </Section>

        <Section style={styles.buttonWrap}>
          <Button href={props.updateUrl} style={styles.button}>
            Confirm new email
          </Button>
        </Section>

        <Text style={styles.helperCopy}>
          If the button does not work, open this link directly:
          <br />
          <Link href={props.updateUrl} style={styles.inlineLink}>
            {props.updateUrl}
          </Link>
        </Text>
      </Section>

      <hr style={styles.hr} />

      <Section>
        <Text style={styles.footerCopy}>
          If you did not request this change, ignore this email and secure your account. If you need help,{" "}
          <Link href={`mailto:${supportEmail}`} style={styles.footerLink}>
            contact support
          </Link>
          .
        </Text>
      </Section>
    </ChartbrewLayout>
  );
}

type PreviewableEmail = typeof EmailUpdateEmail & {
  PreviewProps?: EmailUpdateEmailProps;
};

(EmailUpdateEmail as PreviewableEmail).PreviewProps = {
  updateUrl: "https://app.chartbrew.com/user/profile?email=preview-token-123",
};

const styles = {
  logo: {
    marginBottom: "28px",
    display: "block",
  },
  eyebrow: {
    margin: "0 0 10px",
    color: "#4b8fcc",
    fontSize: "13px",
    fontWeight: "700",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  },
  title: {
    margin: "0 0 18px",
    fontSize: "26px",
    lineHeight: "1.25",
    fontWeight: "700",
    color: "#030712",
  },
  bodyCopy: {
    margin: "0 0 24px",
    fontSize: "16px",
    lineHeight: "1.65",
    color: "#4b5563",
  },
  panel: {
    margin: "0 0 28px",
    padding: "18px 20px",
    backgroundColor: "#f3f7fb",
    borderRadius: "10px",
    border: "1px solid #d7e6f4",
  },
  panelTitle: {
    margin: "0 0 10px",
    fontSize: "14px",
    lineHeight: "1.5",
    fontWeight: "700",
    color: "#0f172a",
  },
  panelCopy: {
    margin: "0 0 8px",
    fontSize: "14px",
    lineHeight: "1.6",
    color: "#475569",
  },
  buttonWrap: {
    margin: "0 0 24px",
  },
  button: {
    backgroundColor: "#0f172a",
    borderRadius: "8px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: "700",
    padding: "14px 24px",
    textDecoration: "none",
  },
  helperCopy: {
    margin: "0 0 20px",
    fontSize: "14px",
    lineHeight: "1.7",
    color: "#6b7280",
  },
  inlineLink: {
    color: "#4b8fcc",
    textDecoration: "underline",
    wordBreak: "break-all" as const,
  },
  footerCopy: {
    margin: "0",
    fontSize: "14px",
    lineHeight: "1.7",
    color: "#6b7280",
  },
  footerLink: {
    color: "#111827",
    textDecoration: "underline",
  },
  hr: {
    border: "none",
    borderTop: "1px solid #e5e7eb",
    margin: "20px 0",
  },
};
