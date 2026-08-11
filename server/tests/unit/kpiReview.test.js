import {
  afterEach, describe, expect, it, vi,
} from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const db = require("../../models/models");
const {
  buildKpiReview,
  claimKpiReviewDelivery,
  completeKpiReviewDelivery,
} = require("../../modules/observations/kpiReview");
const DigestController = require("../../controllers/DigestController");
const {
  getRecommendedCadence,
  serializeSubscription,
  shouldHoldKpiReview,
  validateSubscription,
} = require("../../controllers/DigestController");
const mail = require("../../modules/mail");

function createMonitor(overrides = {}) {
  return {
    id: "monitor-1",
    importance: 2,
    metric_spec: {
      desiredDirection: "higher",
      valueFormat: {
        display: { decimals: 0, scale: 1 },
        meaning: "number",
      },
    },
    name: "Revenue",
    project_id: 4,
    status: "ready",
    status_reason: null,
    Project: { id: 4, name: "Growth" },
    ...overrides,
  };
}

function createEvaluation(overrides = {}) {
  return {
    absolute_delta: 20,
    baseline_value: 100,
    calendar_timezone: "UTC",
    comparison_period: "month",
    comparison_period_end: new Date("2026-07-01T00:00:00.000Z"),
    comparison_period_start: new Date("2026-06-01T00:00:00.000Z"),
    current_period_end: new Date("2026-08-01T00:00:00.000Z"),
    current_period_start: new Date("2026-07-01T00:00:00.000Z"),
    current_value: 120,
    evaluation_key: "july-vs-june",
    finality: "final",
    id: "evaluation-1",
    monitor_id: "monitor-1",
    passes_threshold: true,
    relative_delta: 0.2,
    revision: 1,
    MetricMonitor: createMonitor(),
    Observation: { id: "observation-1" },
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("KPI reviews", () => {
  it("serializes delivery days stored as JSON text", () => {
    const subscription = {
      cadence: "daily",
      channel: "email",
      content_mode: "kpi_review",
      day_of_month: 1,
      day_of_week: 1,
      delivery_days: JSON.stringify(["monday", "friday"]),
      enabled: false,
      evaluation_wait_minutes: 120,
      id: "subscription-1",
      local_delivery_time: "09:00",
      timezone: "UTC",
    };

    expect(serializeSubscription(subscription).deliveryDays).toEqual(["monday", "friday"]);
  });

  it("selects an undelivered correction and reports incomplete metrics honestly", async () => {
    const monitor = createMonitor();
    const waitingMonitor = createMonitor({
      id: "monitor-2",
      name: "Failed sync rate",
      status: "waiting_for_data",
      status_reason: "incomplete_coverage",
    });
    const original = createEvaluation({ MetricMonitor: monitor });
    const correction = createEvaluation({
      current_value: 118,
      finality: "revised",
      id: "evaluation-2",
      relative_delta: 0.18,
      revision: 2,
      MetricMonitor: monitor,
    });
    const latestDelivered = createEvaluation({
      baseline_value: 118,
      comparison_period_end: new Date("2026-08-01T00:00:00.000Z"),
      comparison_period_start: new Date("2026-07-01T00:00:00.000Z"),
      current_period_end: new Date("2026-09-01T00:00:00.000Z"),
      current_period_start: new Date("2026-08-01T00:00:00.000Z"),
      current_value: 121,
      evaluation_key: "august-vs-july",
      id: "evaluation-3",
      passes_threshold: false,
      relative_delta: 3 / 118,
      MetricMonitor: monitor,
      Observation: null,
    });
    vi.spyOn(db.MetricEvaluation, "findAll").mockResolvedValue([
      latestDelivered,
      correction,
      original,
    ]);
    vi.spyOn(db.MetricMonitor, "findAll").mockResolvedValue([monitor, waitingMonitor]);
    vi.spyOn(db.ObservationDigestDeliveryItem, "findAll").mockResolvedValue([{
      evaluation_revision: 1,
      metric_evaluation_id: "evaluation-3",
      status: "delivered",
    }]);
    vi.spyOn(db.Observation, "findAll").mockResolvedValue([{
      direction: "decrease",
      evidence: { comparisonLabel: "Yesterday compared with the day before" },
      id: "attention-1",
      Project: waitingMonitor.Project,
      MetricMonitor: waitingMonitor,
      summary: "The latest complete day was lower.",
      title: "Failed sync rate increased",
    }]);

    const review = await buildKpiReview({
      allProjects: true,
      projectIds: [],
      teamId: 8,
    }, { id: "subscription-1" });

    expect(review.kpis).toHaveLength(1);
    expect(review.kpis[0]).toEqual(expect.objectContaining({
      comparisonLabel: "July 2026 compared with June 2026",
      corrected: true,
      evaluationId: "evaluation-2",
    }));
    expect(review.waitingMetrics).toEqual([expect.objectContaining({
      name: "Failed sync rate",
      reason: "The completed period has missing data",
    })]);
    expect(review.attentionItems).toEqual([expect.objectContaining({ id: "attention-1" })]);
  });

  it("reserves an evaluation revision before delivery and completes its claim", async () => {
    const record = {
      id: "delivery-1",
      status: "pending",
    };
    const findSpy = vi.spyOn(db.ObservationDigestDeliveryItem, "findOrCreate")
      .mockResolvedValue([record, true]);
    const updateSpy = vi.spyOn(db.ObservationDigestDeliveryItem, "update")
      .mockResolvedValue([1]);
    const now = new Date("2026-08-10T09:00:00.000Z");
    const evaluationRecords = [{
      evaluationId: "evaluation-2",
      revision: 2,
    }];

    const claimed = await claimKpiReviewDelivery(
      { id: "subscription-1" },
      evaluationRecords,
      now
    );
    await completeKpiReviewDelivery({ id: "subscription-1" }, claimed, now);

    expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
      defaults: {
        delivery_attempted_at: now,
        status: "pending",
      },
      where: {
        evaluation_revision: 2,
        metric_evaluation_id: "evaluation-2",
        subscription_id: "subscription-1",
      },
    }));
    expect(claimed).toEqual(evaluationRecords);
    expect(updateSpy).toHaveBeenCalledWith({
      delivered_at: now,
      status: "delivered",
    }, {
      where: {
        evaluation_revision: 2,
        metric_evaluation_id: "evaluation-2",
        status: "pending",
        subscription_id: "subscription-1",
      },
    });
  });

  it("validates monthly KPI review settings and recommends cadence from the metric periods", async () => {
    const values = await validateSubscription({
      allProjects: true,
      projectIds: [],
      teamId: 8,
    }, {
      cadence: "monthly",
      contentMode: "kpi_review",
      dayOfMonth: 15,
      localDeliveryTime: "09:00",
      timezone: "UTC",
    });

    expect(values).toEqual(expect.objectContaining({
      cadence: "monthly",
      content_mode: "kpi_review",
      day_of_month: 15,
      evaluation_wait_minutes: 120,
    }));
    expect(getRecommendedCadence([
      { baseline_policy: { comparisonPeriod: "month" } },
      { baseline_policy: { comparisonPeriod: "month" } },
    ])).toBe("monthly");
    expect(getRecommendedCadence([
      { baseline_policy: { comparisonPeriod: "month" } },
      { baseline_policy: { comparisonPeriod: "day" } },
    ])).toBe("daily");
  });

  it("holds a scheduled review only while a completed result is settling", () => {
    const digest = {
      content_mode: "kpi_review",
      evaluation_wait_minutes: 120,
      local_delivery_time: "09:00",
      timezone: "UTC",
    };
    const content = { waitingMetrics: [{ settling: true }] };

    expect(shouldHoldKpiReview(
      digest,
      content,
      new Date("2026-08-10T10:30:00.000Z")
    )).toBe(true);
    expect(shouldHoldKpiReview(
      digest,
      content,
      new Date("2026-08-10T11:00:00.000Z")
    )).toBe(false);
    expect(shouldHoldKpiReview(
      digest,
      { waitingMetrics: [{ settling: false }] },
      new Date("2026-08-10T09:15:00.000Z")
    )).toBe(false);
  });

  it("claims evaluation revisions before it sends a KPI review", async () => {
    const order = [];
    const controller = new DigestController();
    const digest = {
      content_mode: "kpi_review",
      evaluation_wait_minutes: 120,
      id: "subscription-1",
      local_delivery_time: "09:00",
      timezone: "UTC",
      update: vi.fn().mockResolvedValue(undefined),
      User: { email: "maya@example.com" },
    };
    const evaluationRecord = { evaluationId: "evaluation-1", revision: 1 };
    const kpi = { ...evaluationRecord, name: "Revenue" };
    vi.spyOn(controller, "buildContent").mockResolvedValue({
      attentionItems: [],
      evaluationRecords: [evaluationRecord],
      health: { count: 0 },
      kpis: [kpi],
      mailData: { kpis: [kpi] },
      observations: [],
      user: { email: "maya@example.com" },
      waitingMetrics: [],
    });
    vi.spyOn(db.ObservationDigestDeliveryItem, "findOrCreate")
      .mockImplementation(async () => {
        order.push("claimed");
        return [{ id: "delivery-1", status: "pending" }, true];
      });
    vi.spyOn(db.ObservationDigestDeliveryItem, "update")
      .mockImplementation(async (values) => {
        if (values.status === "delivered") order.push("completed");
        return [1];
      });
    vi.spyOn(mail, "sendObservationDigest").mockImplementation(async () => {
      order.push("sent");
    });

    const result = await controller.deliver({ teamId: 8 }, digest, {
      now: new Date("2026-08-10T11:00:00.000Z"),
    });

    expect(result).toEqual({ delivered: true, empty: false });
    expect(order).toEqual(["claimed", "sent", "completed"]);
  });

  it("releases an evaluation claim when email delivery fails", async () => {
    const controller = new DigestController();
    const digest = {
      content_mode: "kpi_review",
      evaluation_wait_minutes: 120,
      id: "subscription-1",
      local_delivery_time: "09:00",
      timezone: "UTC",
      User: { email: "maya@example.com" },
    };
    const evaluationRecord = { evaluationId: "evaluation-1", revision: 1 };
    const kpi = { ...evaluationRecord, name: "Revenue" };
    vi.spyOn(controller, "buildContent").mockResolvedValue({
      attentionItems: [],
      evaluationRecords: [evaluationRecord],
      health: { count: 0 },
      kpis: [kpi],
      mailData: { kpis: [kpi] },
      observations: [],
      user: { email: "maya@example.com" },
      waitingMetrics: [],
    });
    vi.spyOn(db.ObservationDigestDeliveryItem, "findOrCreate")
      .mockResolvedValue([{ id: "delivery-1", status: "pending" }, true]);
    const updateSpy = vi.spyOn(db.ObservationDigestDeliveryItem, "update")
      .mockResolvedValue([1]);
    vi.spyOn(mail, "sendObservationDigest").mockRejectedValue(new Error("Email failed"));

    await expect(controller.deliver({ teamId: 8 }, digest, {
      now: new Date("2026-08-10T11:00:00.000Z"),
    })).rejects.toThrow("Email failed");

    expect(updateSpy).toHaveBeenCalledWith({ status: "failed" }, {
      where: {
        evaluation_revision: 1,
        metric_evaluation_id: "evaluation-1",
        status: "pending",
        subscription_id: "subscription-1",
      },
    });
  });

  it("defers delivery during settling and sends one waiting review after the hold", async () => {
    const controller = new DigestController();
    const digest = {
      content_mode: "kpi_review",
      evaluation_wait_minutes: 120,
      id: "subscription-1",
      last_delivery_status: null,
      local_delivery_time: "09:00",
      timezone: "UTC",
      update: vi.fn().mockResolvedValue(undefined),
      User: { email: "maya@example.com" },
    };
    const content = {
      attentionItems: [],
      evaluationRecords: [],
      health: { count: 0 },
      kpis: [],
      mailData: {},
      observations: [],
      user: { email: "maya@example.com" },
      waitingMetrics: [{ name: "Revenue", settling: true }],
    };
    vi.spyOn(controller, "buildContent").mockResolvedValue(content);
    const sendSpy = vi.spyOn(mail, "sendObservationDigest").mockResolvedValue(undefined);

    const deferred = await controller.deliver({ teamId: 8 }, digest, {
      now: new Date("2026-08-10T10:30:00.000Z"),
    });
    expect(deferred).toEqual({ deferred: true, delivered: false, empty: false });
    expect(sendSpy).not.toHaveBeenCalled();

    const delivered = await controller.deliver({ teamId: 8 }, digest, {
      now: new Date("2026-08-10T11:00:00.000Z"),
    });
    expect(delivered).toEqual({ delivered: true, empty: false });
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(digest.update).toHaveBeenCalledWith(expect.objectContaining({
      last_delivery_status: "waiting_for_data",
    }));
  });

  it("does not repeat a waiting email while it checks for a late result", async () => {
    const controller = new DigestController();
    const digest = {
      content_mode: "kpi_review",
      evaluation_wait_minutes: 120,
      id: "subscription-1",
      last_delivery_status: "waiting_for_data",
      local_delivery_time: "09:00",
      timezone: "UTC",
      User: { email: "maya@example.com" },
    };
    vi.spyOn(controller, "buildContent").mockResolvedValue({
      attentionItems: [],
      evaluationRecords: [],
      health: { count: 0 },
      kpis: [],
      mailData: {},
      observations: [],
      user: { email: "maya@example.com" },
      waitingMetrics: [{ name: "Revenue", settling: true }],
    });
    const sendSpy = vi.spyOn(mail, "sendObservationDigest").mockResolvedValue(undefined);

    const result = await controller.deliver({ teamId: 8 }, digest, {
      lateRetry: true,
      now: new Date("2026-08-11T12:00:00.000Z"),
    });

    expect(result).toEqual({ delivered: false, empty: false, pending: true });
    expect(sendSpy).not.toHaveBeenCalled();
  });
});
