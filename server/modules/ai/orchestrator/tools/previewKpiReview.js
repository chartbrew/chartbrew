const DigestController = require("../../../../controllers/DigestController");
const { getObservationAccess } = require("../../../observations/access");
const { getWorkspaceAccessEnvelope } = require("../../../workspaceContext/accessEnvelope");
const { assertPreviewInstruction } = require("../../../workspaceContext/instructionGate");
const { createPendingAction } = require("../../../workspaceContext/previewStore");

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function normalizeKpiReviewInput(payload = {}) {
  const scope = payload.scope || {};
  const data = {
    cadence: payload.cadence,
    contentMode: payload.content_mode,
    dayOfMonth: payload.day_of_month,
    dayOfWeek: payload.day_of_week,
    deliveryDays: payload.delivery_days,
    enabled: payload.enabled,
    evaluationWaitMinutes: payload.evaluation_wait_minutes,
    localDeliveryTime: payload.local_delivery_time,
    monitorId: scope.type === "monitor" ? scope.id : undefined,
    projectId: scope.type === "project" ? scope.id : undefined,
    timezone: payload.timezone,
  };
  return Object.keys(data).reduce((result, key) => {
    if (data[key] !== undefined) result[key] = data[key];
    return result;
  }, {});
}

function getScheduleLabel(data = {}) {
  if (data.cadence === "daily") {
    if (Array.isArray(data.deliveryDays) && data.deliveryDays.length > 0) {
      const days = data.deliveryDays.map((day) => `${day}`.replace(/^./, (value) => value.toUpperCase()));
      return `${days.join(", ")} at ${data.localDeliveryTime}`;
    }
    return `Every day at ${data.localDeliveryTime}`;
  }
  if (data.cadence === "monthly") {
    return `Every month on day ${data.dayOfMonth} at ${data.localDeliveryTime}`;
  }
  return `Every ${WEEKDAYS[Number(data.dayOfWeek) - 1] || "week"} at ${data.localDeliveryTime}`;
}

function getChangedValues(data = {}) {
  let scope = "workspace";
  if (data.projectId) scope = `project:${data.projectId}`;
  if (data.monitorId) scope = `monitor:${data.monitorId}`;
  return {
    cadence: data.cadence,
    contentMode: data.contentMode,
    dayOfMonth: data.dayOfMonth,
    dayOfWeek: data.dayOfWeek,
    deliveryDays: data.deliveryDays || null,
    enabled: data.enabled !== false,
    evaluationWaitMinutes: data.evaluationWaitMinutes,
    localDeliveryTime: data.localDeliveryTime,
    scope,
    timezone: data.timezone,
  };
}

async function previewKpiReview(payload) {
  const access = await getObservationAccess(payload.team_id, payload.user_id);
  const envelope = await getWorkspaceAccessEnvelope(access);
  const controller = new DigestController();
  const mode = payload.mode === "update" ? "update" : "create";
  assertPreviewInstruction(payload.original_question, `kpi_review.${mode}`);
  const requestedData = normalizeKpiReviewInput(payload);
  let plan;
  let resourceId = null;
  let resourceVersion = null;

  if (mode === "create") {
    plan = await controller.previewCreate(access, requestedData);
  } else {
    if (!payload.subscription_id) {
      const error = new Error("Choose the KPI review to change");
      error.statusCode = 400;
      throw error;
    }
    plan = await controller.previewUpdate(access, payload.subscription_id, requestedData);
    resourceId = plan.subscription.id;
    resourceVersion = plan.subscription.updatedAt?.toISOString() || null;
  }

  const data = plan.data;
  const facts = await controller.previewFacts(access, data);
  const changedValues = getChangedValues(data);
  const pending = await createPendingAction({
    access,
    accessVersion: envelope.accessVersion,
    actionType: `kpi_review.${mode}`,
    projectId: facts.projectId,
    proposal: {
      changedValues,
      data,
      mode,
      subscriptionId: resourceId,
    },
    resourceId,
    resourceVersion,
    sessionId: payload.ai_session_id,
  });

  return {
    actionId: pending.actionId,
    expiresAt: pending.expiresAt,
    preview: {
      action: mode,
      activeHealthCount: facts.activeHealthCount,
      contentModeLabel: data.contentMode === "changes_only" ? "Changes only" : "KPI review",
      eligibleMetricCount: facts.eligibleMetricCount,
      nextDeliveryAt: facts.nextDeliveryAt,
      recipient: facts.recipient,
      scheduleLabel: getScheduleLabel(data),
      scopeLabel: facts.scopeLabel,
      timezone: data.timezone,
      waitingMetricCount: facts.waitingMetricCount,
    },
    status: "ready_for_confirmation",
    warnings: [],
  };
}

module.exports = previewKpiReview;
module.exports.getChangedValues = getChangedValues;
module.exports.getScheduleLabel = getScheduleLabel;
module.exports.normalizeKpiReviewInput = normalizeKpiReviewInput;
