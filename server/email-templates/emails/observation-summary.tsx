import * as React from "react";
import {
  Button, Hr, Img, Link, Section, Text,
} from "@react-email/components";

import ChartbrewLayout from "./components/chartbrew-layout";

export type ObservationSummaryEmailProps = {
  activityUrl: string;
  attentionItems: Array<{
    comparisonLabel?: string | null;
    id: string;
    project?: { name?: string | null } | null;
    summary: string;
    title: string;
  }>;
  appName?: string;
  browserUrl?: string;
  contentMode: "changes_only" | "kpi_review";
  healthItems: Array<{ message: string }>;
  kpis: Array<{
    comparisonLabel: string;
    comparisonValueLabel: string;
    corrected: boolean;
    currentValueLabel: string;
    impact: "negative" | "neutral" | "positive";
    material: boolean;
    name: string;
    observationId?: string | null;
    project?: { name?: string | null } | null;
    statusLabel: string;
  }>;
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
  waitingMetrics: Array<{
    name: string;
    project?: { name?: string | null } | null;
    reason: string;
  }>;
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
  const isKpiReview = props.contentMode === "kpi_review";
  const materialKpis = props.kpis.filter((item) => item.material);
  const stableKpis = props.kpis.filter((item) => !item.material);
  const updateCount = props.kpis.length
    + props.observations.length
    + props.attentionItems.length
    + props.waitingMetrics.length
    + props.healthItems.length;
  const greetingName = props.recipientName?.split(" ")[0];

  return (
    <ChartbrewLayout
      previewText={`${updateCount} update${updateCount === 1 ? "" : "s"} from ${props.teamName}.`}
      browserUrl={props.browserUrl}
    >
      <Section>
        <Img src={logoUrl} alt={`${appName} logo`} width="200" style={styles.logo} />
        <Text style={styles.eyebrow}>{isKpiReview ? "KPI review" : "Changes only"}</Text>
        <Text style={styles.title}>
          {greetingName ? `Hi ${greetingName}, here’s` : "Here’s"}{" "}
          {isKpiReview ? "your latest KPI review" : "what needs attention"}
        </Text>
        <Text style={styles.bodyCopy}>
          This email covers {props.scopeName} in {props.teamName}.
        </Text>

        {materialKpis.length > 0 ? (
          <Section style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Key results</Text>
            {materialKpis.map((kpi) => (
              <Section key={`${kpi.name}-${kpi.comparisonLabel}`} style={styles.item}>
                <Text style={getImpactLabelStyle(kpi.impact)}>
                  {kpi.corrected ? "Corrected · " : ""}{kpi.statusLabel}
                </Text>
                <Text style={styles.itemTitle}>{kpi.name}</Text>
                <Text style={styles.itemCopy}>
                  {kpi.comparisonLabel}: {kpi.currentValueLabel}, from {kpi.comparisonValueLabel}.
                </Text>
                {kpi.observationId ? (
                  <Link href={`${props.activityUrl}/${kpi.observationId}`} style={styles.itemLink}>
                    View change
                  </Link>
                ) : null}
              </Section>
            ))}
          </Section>
        ) : null}

        {stableKpis.length > 0 ? (
          <Section style={styles.stableWrap}>
            <Text style={styles.sectionTitle}>No meaningful change</Text>
            {stableKpis.map((kpi) => (
              <Text key={`${kpi.name}-${kpi.comparisonLabel}`} style={styles.stableItem}>
                <strong>{kpi.name}</strong> · {kpi.currentValueLabel} · {kpi.comparisonLabel}
                {kpi.corrected ? " · Corrected" : ""}
              </Text>
            ))}
          </Section>
        ) : null}

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

        {props.attentionItems.length > 0 ? (
          <Section style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Still needs attention</Text>
            {props.attentionItems.map((item) => (
              <Section key={item.id} style={styles.item}>
                <Text style={styles.negativeLabel}>{item.project?.name || "Workspace"}</Text>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemCopy}>{item.summary}</Text>
                <Link href={`${props.activityUrl}/${item.id}`} style={styles.itemLink}>
                  View change
                </Link>
              </Section>
            ))}
          </Section>
        ) : null}

        {props.waitingMetrics.length > 0 ? (
          <Section style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Waiting for complete data</Text>
            {props.waitingMetrics.map((metric) => (
              <Section key={metric.name} style={styles.item}>
                <Text style={styles.label}>{metric.project?.name || "Workspace"}</Text>
                <Text style={styles.itemTitle}>{metric.name}</Text>
                <Text style={styles.itemCopy}>{metric.reason}.</Text>
              </Section>
            ))}
          </Section>
        ) : null}

        {updateCount === 0 ? (
          <Section style={styles.emptyItem}>
            <Text style={styles.itemTitle}>No new results</Text>
            <Text style={styles.itemCopy}>There are no completed comparisons to include yet.</Text>
          </Section>
        ) : null}

        <Section style={styles.buttonWrap}>
          <Button href={props.activityUrl} style={styles.button}>Open Activity</Button>
        </Section>
      </Section>

      <Hr style={styles.hr} />
      <Text style={styles.footerCopy}>
        This email was sent from your Chartbrew KPI review schedule. Manage or disable it from Activity.
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
  attentionItems: [],
  contentMode: "kpi_review",
  healthItems: [{ message: "A dataset could not refresh" }],
  kpis: [{
    comparisonLabel: "July 2026 compared with June 2026",
    comparisonValueLabel: "$108,000",
    corrected: false,
    currentValueLabel: "$124,000",
    impact: "positive",
    material: true,
    name: "Revenue",
    observationId: "observation-2",
    project: { name: "SaaS Platform" },
    statusLabel: "Improved",
  }, {
    comparisonLabel: "Jul 28–Aug 3 compared with Jul 21–27, 2026",
    comparisonValueLabel: "4.1%",
    corrected: false,
    currentValueLabel: "4.0%",
    impact: "positive",
    material: false,
    name: "Failed sync rate",
    project: { name: "Operations" },
    statusLabel: "No meaningful change",
  }],
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
  waitingMetrics: [{
    name: "Trial conversion",
    project: { name: "Acquisition" },
    reason: "The completed period has missing data",
  }],
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
  stableItem: { borderTop: "1px solid #e5e7eb", color: "#4b5563", fontSize: "14px", lineHeight: "1.6", margin: "0", padding: "11px 0" },
  stableWrap: { backgroundColor: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: "10px", margin: "0 0 20px", padding: "16px" },
  title: { color: "#030712", fontSize: "26px", fontWeight: "700", lineHeight: "1.25", margin: "0 0 14px" },
};
