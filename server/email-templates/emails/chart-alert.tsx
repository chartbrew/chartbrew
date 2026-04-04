import * as React from "react";
import {
  Button, Hr, Img, Link, Section, Text
} from "@react-email/components";

import ChartbrewLayout from "./components/chartbrew-layout";

export type ChartAlertEmailProps = {
  chartName: string;
  thresholdText: string;
  alerts: string[];
  dashboardUrl: string;
  snapshotUrl?: string | null;
  browserUrl?: string;
  appName?: string;
  logoUrl?: string;
  supportEmail?: string;
};

export const DEFAULT_CHART_ALERT_EMAIL_PROPS = {
  appName: "Chartbrew",
  logoUrl: "https://cdn2.chartbrew.com/logos/logo-light.png",
  supportEmail: "support@chartbrew.com",
} as const;

export default function ChartAlertEmail(props: ChartAlertEmailProps) {
  const appName = props.appName ?? DEFAULT_CHART_ALERT_EMAIL_PROPS.appName;
  const logoUrl = props.logoUrl ?? DEFAULT_CHART_ALERT_EMAIL_PROPS.logoUrl;
  const supportEmail = props.supportEmail ?? DEFAULT_CHART_ALERT_EMAIL_PROPS.supportEmail;

  return (
    <ChartbrewLayout
      previewText={`${props.chartName} triggered ${props.alerts.length} alert${props.alerts.length === 1 ? "" : "s"}.`}
      browserUrl={props.browserUrl}
    >
      <Section>
        <Img src={logoUrl} alt={`${appName} logo`} width="200" style={styles.logo} />

        <Text style={styles.eyebrow}>Monitoring update</Text>
        <Text style={styles.title}>{props.chartName} has a new alert</Text>
        <Text style={styles.bodyCopy}>{props.thresholdText}</Text>

        <Section style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Triggered points</Text>
          {props.alerts.map((alert) => (
            <Text key={alert} style={styles.alertItem}>
              {alert}
            </Text>
          ))}
        </Section>

        <Section style={styles.buttonWrap}>
          <Button href={props.dashboardUrl} style={styles.button}>
            Open dashboard
          </Button>
        </Section>

        {props.snapshotUrl ? (
          <Section style={styles.snapshotCard}>
            <Text style={styles.snapshotTitle}>Snapshot preview</Text>
            <Text style={styles.snapshotCopy}>
              A recent snapshot is included below so you can assess the trend before opening the dashboard.
            </Text>
            <Link href={props.dashboardUrl}>
              <Img src={props.snapshotUrl} alt={`${props.chartName} snapshot`} style={styles.snapshotImage} />
            </Link>
          </Section>
        ) : null}
      </Section>

      <Hr style={styles.hr} />

      <Section>
        <Text style={styles.footerCopy}>
          Need to adjust thresholds or notification settings? Review this chart in your dashboard, or{" "}
          <Link href={`mailto:${supportEmail}`} style={styles.footerLink}>
            contact support
          </Link>
          .
        </Text>
      </Section>
    </ChartbrewLayout>
  );
}

type PreviewableEmail = typeof ChartAlertEmail & {
  PreviewProps?: ChartAlertEmailProps;
};

(ChartAlertEmail as PreviewableEmail).PreviewProps = {
  chartName: "Revenue by day",
  thresholdText: "Chartbrew found some values above your threshold of 200.",
  alerts: ["2026-04-03: 245", "2026-04-04: 261"],
  dashboardUrl: "https://app.chartbrew.com/dashboard/123",
  snapshotUrl: "https://dummyimage.com/1200x630/e8eef5/1f2937.png&text=Revenue+Alert",
};

const styles = {
  logo: {
    marginBottom: "28px",
    display: "block",
  },
  eyebrow: {
    margin: "0 0 10px",
    color: "#d97706",
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
    margin: "0 0 22px",
    fontSize: "16px",
    lineHeight: "1.65",
    color: "#4b5563",
  },
  summaryCard: {
    margin: "0 0 26px",
    padding: "20px",
    backgroundColor: "#fff8eb",
    borderRadius: "10px",
    border: "1px solid #f3d29b",
  },
  summaryTitle: {
    margin: "0 0 12px",
    fontSize: "14px",
    lineHeight: "1.5",
    fontWeight: "700",
    color: "#7c2d12",
  },
  alertItem: {
    margin: "0 0 10px",
    fontSize: "15px",
    lineHeight: "1.6",
    color: "#7c2d12",
  },
  buttonWrap: {
    margin: "0 0 28px",
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
  snapshotCard: {
    margin: "0 0 12px",
    padding: "18px",
    backgroundColor: "#f8fafc",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
  },
  snapshotTitle: {
    margin: "0 0 8px",
    fontSize: "15px",
    lineHeight: "1.5",
    fontWeight: "700",
    color: "#111827",
  },
  snapshotCopy: {
    margin: "0 0 14px",
    fontSize: "14px",
    lineHeight: "1.6",
    color: "#6b7280",
  },
  snapshotImage: {
    width: "100%",
    maxWidth: "100%",
    borderRadius: "10px",
    display: "block",
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
