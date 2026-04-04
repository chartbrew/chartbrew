import * as React from "react";
import {
  Button, Hr, Img, Link, Section, Text
} from "@react-email/components";

import ChartbrewLayout from "./components/chartbrew-layout";

export type DashboardSnapshotEmailProps = {
  projectName: string;
  dashboardUrl: string;
  snapshotUrl?: string | null;
  browserUrl?: string;
  appName?: string;
  logoUrl?: string;
  supportEmail?: string;
};

export const DEFAULT_DASHBOARD_SNAPSHOT_EMAIL_PROPS = {
  appName: "Chartbrew",
  logoUrl: "https://cdn2.chartbrew.com/logos/cb_logo_light.svg",
  supportEmail: "support@chartbrew.com",
} as const;

export default function DashboardSnapshotEmail(props: DashboardSnapshotEmailProps) {
  const appName = props.appName ?? DEFAULT_DASHBOARD_SNAPSHOT_EMAIL_PROPS.appName;
  const logoUrl = props.logoUrl ?? DEFAULT_DASHBOARD_SNAPSHOT_EMAIL_PROPS.logoUrl;
  const supportEmail = props.supportEmail ?? DEFAULT_DASHBOARD_SNAPSHOT_EMAIL_PROPS.supportEmail;

  return (
    <ChartbrewLayout
      previewText={`A fresh dashboard snapshot for ${props.projectName} is ready.`}
      browserUrl={props.browserUrl}
    >
      <Section>
        <Img src={logoUrl} alt={`${appName} logo`} width="200" style={styles.logo} />

        <Text style={styles.eyebrow}>Scheduled report</Text>
        <Text style={styles.title}>New snapshot for {props.projectName}</Text>
        <Text style={styles.bodyCopy}>
          Your scheduled dashboard snapshot has been generated. Review the latest image below or open the live
          dashboard for the current view.
        </Text>

        <Section style={styles.buttonWrap}>
          <Button href={props.dashboardUrl} style={styles.button}>
            View live dashboard
          </Button>
        </Section>

        {props.snapshotUrl ? (
          <Section style={styles.snapshotCard}>
            <Text style={styles.snapshotTitle}>Attached preview</Text>
            <Text style={styles.snapshotCopy}>
              This snapshot reflects the dashboard at the time your schedule ran.
            </Text>
            <Link href={props.dashboardUrl}>
              <Img src={props.snapshotUrl} alt={`${props.projectName} snapshot`} style={styles.snapshotImage} />
            </Link>
          </Section>
        ) : null}
      </Section>

      <Hr style={styles.hr} />

      <Section>
        <Text style={styles.footerCopy}>
          This email was sent from your dashboard snapshot schedule. Manage delivery settings from your dashboard, or{" "}
          <Link href={`mailto:${supportEmail}`} style={styles.footerLink}>
            contact support
          </Link>
          {" "}if something looks off.
        </Text>
      </Section>
    </ChartbrewLayout>
  );
}

type PreviewableEmail = typeof DashboardSnapshotEmail & {
  PreviewProps?: DashboardSnapshotEmailProps;
};

(DashboardSnapshotEmail as PreviewableEmail).PreviewProps = {
  projectName: "North Star Metrics",
  dashboardUrl: "https://app.chartbrew.com/dashboard/456",
  snapshotUrl: "https://dummyimage.com/1200x630/e8eef5/1f2937.png&text=Dashboard+Snapshot",
};

const styles = {
  logo: {
    marginBottom: "28px",
    display: "block",
  },
  eyebrow: {
    margin: "0 0 10px",
    color: "#0f766e",
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
