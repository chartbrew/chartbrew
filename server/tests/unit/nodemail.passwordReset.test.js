import {
  beforeEach, describe, expect, it, vi
} from "vitest";

function normalizeHtml(html) {
  return html.replace(/<!-- -->/g, "");
}

describe("nodemail React Email templates", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = "test";
    process.env.CB_ADMIN_MAIL_DEV = "support@chartbrew.com";
  });

  it("renders the forgot password React email template into HTML", async () => {
    const resetUrl = "https://app.chartbrew.com/passwordReset?token=test-reset-token";
    const mailModule = await import("../../modules/mail.js");
    const mail = mailModule.default || mailModule;

    const result = await mail.passwordReset({
      email: "reset.user@example.com",
      resetUrl,
    });

    const message = JSON.parse(result.message);
    const html = normalizeHtml(message.html);
    expect(message.to).toEqual([{
      address: "reset.user@example.com",
      name: "",
    }]);
    expect(message.text).toContain(resetUrl);
    expect(html).toContain("Click to reset password");
    expect(html).toContain(resetUrl);
  });

  it("renders the email update template into HTML", async () => {
    const updateUrl = "https://app.chartbrew.com/settings/profile?email=test-token";
    const mailModule = await import("../../modules/mail.js");
    const mail = mailModule.default || mailModule;

    const result = await mail.emailUpdate({
      email: "updated.user@example.com",
      updateUrl,
    });

    const message = JSON.parse(result.message);
    const html = normalizeHtml(message.html);
    expect(message.to).toEqual([{
      address: "updated.user@example.com",
      name: "",
    }]);
    expect(message.subject).toBe("Chartbrew - new email confirmation");
    expect(message.text).toContain(updateUrl);
    expect(html).toContain("Confirm your new email");
    expect(html).toContain("expires in 3 hours");
    expect(html).toContain(updateUrl);
  });

  it("renders the chart alert template into HTML", async () => {
    const dashboardUrl = "https://app.chartbrew.com/dashboard/123";
    const snapshotUrl = "https://cdn.chartbrew.com/snapshots/chart-123.png";
    const mailModule = await import("../../modules/mail.js");
    const mail = mailModule.default || mailModule;

    const result = await mail.sendChartAlert({
      chartName: "Revenue by day",
      recipients: ["alerts@example.com"],
      thresholdText: "Chartbrew found some values above your threshold of 200.",
      alerts: [{
        label: "2026-04-03",
        seriesId: "enterprise",
        seriesLabel: "Enterprise",
        value: 245,
      }, {
        label: "2026-04-04",
        seriesId: "self-serve",
        seriesLabel: "Self-serve",
        value: 261,
      }],
      dashboardUrl,
      snapshotUrl,
    });

    const message = JSON.parse(result.message);
    const html = normalizeHtml(message.html);
    expect(message.subject).toBe("Chartbrew - Revenue by day alert");
    expect(message.text).toContain("Enterprise — 2026-04-03: 245");
    expect(message.text).toContain(dashboardUrl);
    expect(html).toContain("Revenue by day has a new alert");
    expect(html).toContain("Enterprise");
    expect(html).toContain("2026-04-04: 261");
    expect(html).toContain(snapshotUrl);
    expect(html).toContain(dashboardUrl);
  });

  it("renders the dashboard snapshot template into HTML", async () => {
    const dashboardUrl = "https://app.chartbrew.com/dashboard/456";
    const snapshotUrl = "https://cdn.chartbrew.com/snapshots/dashboard-456.png";
    const mailModule = await import("../../modules/mail.js");
    const mail = mailModule.default || mailModule;

    const result = await mail.sendDashboardSnapshot({
      projectName: "North Star Metrics",
      recipients: ["reports@example.com"],
      dashboardUrl,
      snapshotUrl,
      attachments: [],
    });

    const message = JSON.parse(result.message);
    const html = normalizeHtml(message.html);
    expect(message.to).toEqual([{
      address: "reports@example.com",
      name: "",
    }]);
    expect(message.subject).toBe("Chartbrew - North Star Metrics snapshot");
    expect(message.text).toContain("View live dashboard");
    expect(message.text).toContain(snapshotUrl);
    expect(html).toContain("New snapshot for North Star Metrics");
    expect(html).toContain("View live dashboard");
    expect(html).toContain(snapshotUrl);
  });

  it("renders a changes-only email with React Email", async () => {
    const mailModule = await import("../../modules/mail.js");
    const mail = mailModule.default || mailModule;
    const result = await mail.sendObservationDigest({
      attentionItems: [],
      contentMode: "changes_only",
      healthItems: [{ message: "A dataset could not refresh" }],
      kpis: [],
      observations: [{
        id: "observation-1",
        impact: "negative",
        project: { name: "Acquisition" },
        summary: "Organic mobile traffic is the main driver.",
        title: "Trial conversion decreased 18%",
      }, {
        id: "observation-2",
        impact: "positive",
        project: { name: "Revenue" },
        summary: "Expansion revenue increased this week.",
        title: "Revenue increased 30%",
      }],
      recipient: "maya@example.com",
      recipientName: "Maya Chen",
      scopeName: "All accessible dashboards",
      teamName: "Acme Inc.",
      waitingMetrics: [],
    });

    const message = JSON.parse(result.message);
    const html = normalizeHtml(message.html);
    expect(message.to).toEqual([{ address: "maya@example.com", name: "" }]);
    expect(message.subject).toBe("Chartbrew Changes only — Acme Inc.");
    expect(html).toContain("Hi Maya, here’s what needs attention");
    expect(html).toContain("Trial conversion decreased 18%");
    expect(html).toContain("Revenue increased 30%");
    expect(html).toContain("color:#15803d");
    expect(html).toContain("https://cdn2.chartbrew.com/logos/logo-light.png");
    expect(html).toContain("A dataset could not refresh");
    expect(html).toContain("Open Activity");
  });

  it("renders exact KPI periods, stable results, corrections, and waiting metrics", async () => {
    const mailModule = await import("../../modules/mail.js");
    const mail = mailModule.default || mailModule;
    const result = await mail.sendObservationDigest({
      attentionItems: [],
      contentMode: "kpi_review",
      healthItems: [],
      kpis: [{
        comparisonLabel: "July 2026 compared with June 2026",
        comparisonValueLabel: "$100,000",
        corrected: true,
        currentValueLabel: "$118,000",
        impact: "positive",
        material: true,
        name: "Revenue",
        observationId: "observation-1",
        project: { name: "Revenue" },
        statusLabel: "Improved",
      }, {
        comparisonLabel: "Aug 8 compared with Aug 7, 2026",
        comparisonValueLabel: "4.1%",
        corrected: false,
        currentValueLabel: "4.0%",
        impact: "positive",
        material: false,
        name: "Failed sync rate",
        observationId: null,
        project: { name: "Operations" },
        statusLabel: "No meaningful change",
      }],
      observations: [],
      recipient: "maya@example.com",
      recipientName: "Maya Chen",
      scopeName: "All accessible dashboards",
      teamName: "Acme Inc.",
      waitingMetrics: [{
        name: "Trial conversion",
        project: { name: "Acquisition" },
        reason: "The completed period has missing data",
      }],
    });

    const message = JSON.parse(result.message);
    const html = normalizeHtml(message.html);
    expect(message.subject).toBe("Chartbrew KPI review — Acme Inc.");
    expect(message.text).toContain("July 2026 compared with June 2026");
    expect(html).toContain("Hi Maya, here’s your latest KPI review");
    expect(html).toContain("Corrected · Improved");
    expect(html).toContain("No meaningful change");
    expect(html).toContain("Waiting for complete data");
    expect(html).toContain("The completed period has missing data");
  });
});
