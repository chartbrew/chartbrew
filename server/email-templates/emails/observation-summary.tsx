import * as React from "react";
import {
  Button, Hr, Img, Link, Section, Text,
} from "@react-email/components";

import ChartbrewLayout from "./components/chartbrew-layout";

export type ObservationSummaryEmailProps = {
  activityUrl: string;
  appName?: string;
  browserUrl?: string;
  healthItems: Array<{ message: string }>;
  logoUrl?: string;
  observations: Array<{
    id: string;
    impact?: "negative" | "neutral" | "positive";
    project?: { name?: string | null } | null;
    summary: string;
    title: string;
  }>;
  recipientName?: string | null;
  scopeName: string;
  supportEmail?: string;
  teamName: string;
};

const DEFAULT_PROPS = {
  appName: "Chartbrew",
  logoUrl: "https://cdn2.chartbrew.com/logos/logo-light.png",
  supportEmail: "",
} as const;

function getImpactLabelStyle(impact?: "negative" | "neutral" | "positive") {
  if (impact === "negative") return styles.negativeLabel;
  if (impact === "positive") return styles.positiveLabel;
  return styles.label;
}

export default function ObservationSummaryEmail(props: ObservationSummaryEmailProps) {
  const appName = props.appName ?? DEFAULT_PROPS.appName;
  const logoUrl = props.logoUrl ?? DEFAULT_PROPS.logoUrl;
  const supportEmail = props.supportEmail ?? DEFAULT_PROPS.supportEmail;
  const attentionCount = props.observations.length + props.healthItems.length;
  const greetingName = props.recipientName?.split(" ")[0];

  return (
    <ChartbrewLayout
      previewText={`${attentionCount} update${attentionCount === 1 ? "" : "s"} from ${props.teamName}.`}
      browserUrl={props.browserUrl}
    >
      <Section>
        <Img src={logoUrl} alt={`${appName} logo`} width="200" style={styles.logo} />
        <Text style={styles.eyebrow}>Workspace summary</Text>
        <Text style={styles.title}>
          {greetingName ? `Hi ${greetingName}, here’s` : "Here’s"} what needs attention
        </Text>
        <Text style={styles.bodyCopy}>
          This summary covers {props.scopeName} in {props.teamName}.
        </Text>

        {props.observations.length > 0 ? (
          <Section style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Metric changes</Text>
            {props.observations.map((observation) => (
              <Section key={observation.id} style={styles.item}>
                <Text style={getImpactLabelStyle(observation.impact)}>
                  {observation.project?.name || "Workspace"}
                </Text>
                <Text style={styles.itemTitle}>{observation.title}</Text>
                <Text style={styles.itemCopy}>{observation.summary}</Text>
                <Link href={`${props.activityUrl}/${observation.id}`} style={styles.itemLink}>
                  View change
                </Link>
              </Section>
            ))}
          </Section>
        ) : null}

        {props.healthItems.length > 0 ? (
          <Section style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Data health</Text>
            {props.healthItems.map((item, index) => (
              <Section key={`${item.message}-${index}`} style={styles.item}>
                <Text style={styles.negativeLabel}>Refresh issue</Text>
                <Text style={styles.itemTitle}>{item.message}</Text>
                <Text style={styles.itemCopy}>
                  Review the affected data before relying on its metrics.
                </Text>
              </Section>
            ))}
          </Section>
        ) : null}

        {attentionCount === 0 ? (
          <Section style={styles.emptyItem}>
            <Text style={styles.itemTitle}>Nothing needs attention</Text>
            <Text style={styles.itemCopy}>No material changes or refresh issues were found.</Text>
          </Section>
        ) : null}

        <Section style={styles.buttonWrap}>
          <Button href={props.activityUrl} style={styles.button}>Open Activity</Button>
        </Section>
      </Section>

      <Hr style={styles.hr} />
      <Text style={styles.footerCopy}>
        This email was sent from your Chartbrew summary schedule. Manage or disable it from Activity.
        {supportEmail ? (
          <> Need help? <Link href={`mailto:${supportEmail}`} style={styles.footerLink}>Contact support</Link>.</>
        ) : null}
      </Text>
    </ChartbrewLayout>
  );
}

type PreviewableEmail = typeof ObservationSummaryEmail & {
  PreviewProps?: ObservationSummaryEmailProps;
};

(ObservationSummaryEmail as PreviewableEmail).PreviewProps = {
  activityUrl: "https://app.chartbrew.com/activity",
  healthItems: [{ message: "A dataset could not refresh" }],
  observations: [{
    id: "observation-1",
    impact: "negative",
    project: { name: "Acquisition" },
    summary: "Organic mobile traffic is the main driver.",
    title: "Trial conversion decreased 18%",
  }, {
    id: "observation-2",
    impact: "positive",
    project: { name: "SaaS Platform" },
    summary: "Plan upgrades drove most of this week’s growth.",
    title: "Expansion revenue reached a 90-day high",
  }],
  recipientName: "Maya Chen",
  scopeName: "All accessible dashboards",
  teamName: "Acme Inc.",
};

const styles = {
  bodyCopy: { color: "#4b5563", fontSize: "16px", lineHeight: "1.65", margin: "0 0 26px" },
  button: { backgroundColor: "#048BDE", borderRadius: "8px", color: "#ffffff", fontSize: "15px", fontWeight: "700", padding: "14px 24px", textDecoration: "none" },
  buttonWrap: { margin: "26px 0 8px" },
  emptyItem: { backgroundColor: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "16px" },
  eyebrow: { color: "#048BDE", fontSize: "13px", fontWeight: "700", letterSpacing: "0.08em", margin: "0 0 10px", textTransform: "uppercase" as const },
  footerCopy: { color: "#6b7280", fontSize: "13px", lineHeight: "1.7", margin: "0" },
  footerLink: { color: "#111827", textDecoration: "underline" },
  hr: { border: "none", borderTop: "1px solid #e5e7eb", margin: "24px 0" },
  item: { borderTop: "1px solid #e5e7eb", padding: "16px 0" },
  itemCopy: { color: "#4b5563", fontSize: "14px", lineHeight: "1.6", margin: "5px 0 8px" },
  itemLink: { color: "#048BDE", fontSize: "14px", fontWeight: "700", textDecoration: "none" },
  itemTitle: { color: "#111827", fontSize: "16px", fontWeight: "700", lineHeight: "1.5", margin: "4px 0 0" },
  label: { color: "#6b7280", fontSize: "12px", fontWeight: "700", letterSpacing: "0.06em", margin: "0", textTransform: "uppercase" as const },
  logo: { display: "block", marginBottom: "28px" },
  negativeLabel: { color: "#dc2626", fontSize: "12px", fontWeight: "700", letterSpacing: "0.06em", margin: "0", textTransform: "uppercase" as const },
  positiveLabel: { color: "#15803d", fontSize: "12px", fontWeight: "700", letterSpacing: "0.06em", margin: "0", textTransform: "uppercase" as const },
  sectionTitle: { color: "#111827", fontSize: "17px", fontWeight: "700", margin: "0" },
  sectionWrap: { margin: "0 0 12px" },
  title: { color: "#030712", fontSize: "26px", fontWeight: "700", lineHeight: "1.25", margin: "0 0 14px" },
};
