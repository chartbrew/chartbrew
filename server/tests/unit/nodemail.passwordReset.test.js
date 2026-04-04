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
    expect(html).toContain("support@chartbrew.com");
  });

  it("renders the email update template into HTML", async () => {
    const updateUrl = "https://app.chartbrew.com/user/profile?email=test-token";
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
      alerts: ["2026-04-03: 245", "2026-04-04: 261"],
      dashboardUrl,
      snapshotUrl,
    });

    const message = JSON.parse(result.message);
    const html = normalizeHtml(message.html);
    expect(message.subject).toBe("Chartbrew - Revenue by day alert");
    expect(message.text).toContain("2026-04-03: 245");
    expect(message.text).toContain(dashboardUrl);
    expect(html).toContain("Revenue by day has a new alert");
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
});
