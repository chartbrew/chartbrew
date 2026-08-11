const crypto = require("crypto");
const { Op } = require("sequelize");

const { getRefreshSchedule } = require("../../controllers/MonitorController");
const db = require("../../models/models");
const { getProjectScope } = require("../observations/access");
const { getContextLimits } = require("./contextLimits");
const { getWorkspaceOrchestratorPolicy } = require("./policy");

const STRENGTH_RANK = {
  approved_configuration: 3,
  explicit_correction: 6,
  explicit_decision: 5,
  explicit_feedback: 5,
  weak_attention: 2,
  weak_operational: 1,
  workspace_aggregate: 4,
};

function buildSignalId(parts) {
  return crypto
    .createHash("sha256")
    .update(parts.map((part) => `${part ?? ""}`).join(":"))
    .digest("hex")
    .slice(0, 32);
}

function getMonitorSubject(monitor) {
  return {
    metricBehavior: monitor.metric_spec?.metricBehavior || null,
    metricKey: monitor.binding_key || null,
    monitorId: monitor.id,
    nativeTimeGrain: monitor.metric_spec?.timeUnit || null,
  };
}

function buildSignal({
  decision,
  occurredAt,
  projectId,
  signalKey,
  signalType,
  strength,
  subject = {},
  teamId,
  userScope = "current_user",
}) {
  return {
    decision,
    expiresAt: null,
    provenance: {
      occurredAt,
      sourceType: signalType,
    },
    schemaVersion: 1,
    scope: {
      projectId: projectId || null,
      teamId,
      userScope,
    },
    signalId: buildSignalId([teamId, projectId, signalType, signalKey, occurredAt]),
    signalType,
    strength,
    subject,
  };
}

function filterApplicableSignals(signals, options = {}) {
  return signals.filter((signal) => {
    if (options.projectId
      && Number(signal.scope.projectId) !== Number(options.projectId)) return false;
    if (options.monitorId
      && `${signal.subject.monitorId || ""}` !== `${options.monitorId}`) return false;
    if (options.metricKey
      && signal.subject.metricKey !== options.metricKey) return false;
    return true;
  });
}

function sortSignals(left, right) {
  const strengthDifference = (STRENGTH_RANK[right.strength] || 0)
    - (STRENGTH_RANK[left.strength] || 0);
  if (strengthDifference !== 0) return strengthDifference;
  return new Date(right.provenance.occurredAt) - new Date(left.provenance.occurredAt);
}

async function readLearningSources(access, since) {
  const observationScope = {
    team_id: access.teamId,
    ...getProjectScope(access),
  };
  return Promise.all([
    db.ObservationFeedback.findAll({
      attributes: ["id", "reason_code", "updatedAt", "user_id", "verdict"],
      include: [{
        model: db.Observation,
        attributes: ["id", "monitor_id", "project_id"],
        include: [{
          model: db.MetricMonitor,
          attributes: ["binding_key", "id", "metric_spec"],
          required: false,
        }],
        required: true,
        where: observationScope,
      }],
      limit: 500,
      order: [["updatedAt", "DESC"]],
      where: { updatedAt: { [Op.gte]: since } },
    }),
    db.ObservationPreference.findAll({
      attributes: ["dismissed_at", "id", "saved_at", "snoozed_until", "updatedAt"],
      include: [{
        model: db.Observation,
        attributes: ["id", "monitor_id", "project_id"],
        include: [{
          model: db.MetricMonitor,
          attributes: ["binding_key", "id", "metric_spec"],
          required: false,
        }],
        required: true,
        where: observationScope,
      }],
      limit: 200,
      order: [["updatedAt", "DESC"]],
      where: { user_id: access.userId, updatedAt: { [Op.gte]: since } },
    }),
    db.MetricRecommendationDismissal.findAll({
      attributes: [
        "binding_key", "chart_id", "dismissal_type", "dismissed_by", "expires_at", "id",
        "project_id", "updatedAt",
      ],
      limit: 100,
      order: [["updatedAt", "DESC"]],
      where: {
        dismissed_by: access.userId,
        team_id: access.teamId,
        ...getProjectScope(access),
      },
    }),
    db.MetricMonitor.findAll({
      attributes: [
        "baseline_policy", "binding_key", "id", "importance", "metric_spec", "project_id",
        "publication_policy", "updatedAt",
      ],
      include: [{
        attributes: ["autoUpdate"],
        model: db.Chart,
        required: false,
      }, {
        attributes: ["updateSchedule"],
        model: db.Project,
        required: false,
      }],
      limit: 100,
      order: [["updatedAt", "DESC"]],
      where: {
        is_active: true,
        team_id: access.teamId,
        ...getProjectScope(access),
      },
    }),
    db.ObservationDigestSubscription.findAll({
      attributes: [
        "cadence", "content_mode", "id", "local_delivery_time", "monitor_id", "project_id",
        "timezone", "updatedAt",
      ],
      include: [{
        attributes: ["project_id"],
        model: db.MetricMonitor,
        required: false,
      }],
      limit: 10,
      order: [["updatedAt", "DESC"]],
      where: { team_id: access.teamId, user_id: access.userId },
    }),
    db.PinnedDashboard.findAll({
      attributes: ["id", "project_id", "updatedAt"],
      limit: 100,
      order: [["updatedAt", "DESC"]],
      where: {
        team_id: access.teamId,
        user_id: access.userId,
        ...(access.allProjects ? {} : {
          project_id: { [Op.in]: access.projectIds.length > 0 ? access.projectIds : [-1] },
        }),
      },
    }),
    db.OrchestratorActionAudit.findAll({
      attributes: [
        "action_type", "after_values", "before_values", "changed_fields", "createdAt", "id",
        "project_id", "resource_id", "status",
      ],
      limit: 100,
      order: [["createdAt", "DESC"]],
      where: {
        actor_user_id: access.userId,
        createdAt: { [Op.gte]: since },
        status: "applied",
        team_id: access.teamId,
        ...(access.allProjects ? {} : {
          [Op.or]: [
            { project_id: null },
            { project_id: { [Op.in]: access.projectIds.length > 0 ? access.projectIds : [-1] } },
          ],
        }),
      },
    }),
  ]);
}

function isKpiReviewAccessible(subscription, access) {
  const projectId = subscription.project_id || subscription.MetricMonitor?.project_id;
  if (!projectId || access.allProjects) return true;
  return access.projectIds.includes(Number(projectId));
}

function projectFeedback(feedbackRows, access) {
  const signals = [];
  const aggregates = new Map();
  feedbackRows.forEach((feedback) => {
    const observation = feedback.Observation;
    const monitor = observation?.MetricMonitor;
    const aggregateKey = [
      observation?.project_id,
      monitor?.binding_key,
      feedback.verdict,
      feedback.reason_code,
    ].join(":");
    const aggregate = aggregates.get(aggregateKey) || {
      feedback,
      users: new Set(),
    };
    aggregate.users.add(Number(feedback.user_id));
    aggregates.set(aggregateKey, aggregate);
    if (Number(feedback.user_id) !== Number(access.userId)) return;
    signals.push(buildSignal({
      decision: {
        reasonCode: feedback.reason_code || null,
        verdict: feedback.verdict,
      },
      occurredAt: feedback.updatedAt,
      projectId: observation.project_id,
      signalKey: feedback.id,
      signalType: "observation_feedback",
      strength: "explicit_feedback",
      subject: monitor ? getMonitorSubject(monitor) : {},
      teamId: access.teamId,
    }));
  });
  aggregates.forEach(({ feedback, users }, key) => {
    if (users.size < 5) return;
    const observation = feedback.Observation;
    const monitor = observation?.MetricMonitor;
    signals.push(buildSignal({
      decision: {
        minimumCohortMet: true,
        reasonCode: feedback.reason_code || null,
        verdict: feedback.verdict,
      },
      occurredAt: feedback.updatedAt,
      projectId: observation.project_id,
      signalKey: key,
      signalType: "workspace_feedback_aggregate",
      strength: "workspace_aggregate",
      subject: monitor ? getMonitorSubject(monitor) : {},
      teamId: access.teamId,
      userScope: "workspace",
    }));
  });
  return signals;
}

function projectLearningSignals(sources, access) {
  const [
    feedbackRows,
    preferences,
    dismissals,
    monitors,
    subscriptions,
    pins,
    audits,
  ] = sources;
  const signals = projectFeedback(feedbackRows, access);
  const monitorsById = new Map(monitors.map((monitor) => [`${monitor.id}`, monitor]));
  preferences.forEach((preference) => {
    const observation = preference.Observation;
    const monitor = observation?.MetricMonitor;
    let decision = null;
    if (preference.saved_at) decision = { attention: "saved" };
    else if (preference.dismissed_at) decision = { attention: "dismissed" };
    else if (preference.snoozed_until) decision = { attention: "snoozed" };
    if (!decision) return;
    signals.push(buildSignal({
      decision,
      occurredAt: preference.updatedAt,
      projectId: observation.project_id,
      signalKey: preference.id,
      signalType: "observation_preference",
      strength: "weak_attention",
      subject: monitor ? getMonitorSubject(monitor) : {},
      teamId: access.teamId,
    }));
  });
  dismissals.forEach((dismissal) => {
    signals.push(buildSignal({
      decision: {
        dismissalType: dismissal.dismissal_type,
      },
      occurredAt: dismissal.updatedAt,
      projectId: dismissal.project_id,
      signalKey: dismissal.id,
      signalType: "metric_recommendation_dismissal",
      strength: "explicit_decision",
      subject: {
        chartId: dismissal.chart_id,
        metricKey: dismissal.binding_key,
      },
      teamId: access.teamId,
    }));
  });
  monitors.forEach((monitor) => {
    signals.push(buildSignal({
      decision: {
        comparisonPeriod: monitor.baseline_policy?.comparisonPeriod || null,
        desiredDirection: monitor.metric_spec?.desiredDirection || null,
        importance: monitor.importance,
        metricBehavior: monitor.metric_spec?.metricBehavior || null,
        thresholdType: monitor.publication_policy?.thresholdType || null,
        thresholdValue: monitor.publication_policy?.thresholdValue ?? null,
      },
      occurredAt: monitor.updatedAt,
      projectId: monitor.project_id,
      signalKey: monitor.id,
      signalType: "metric_monitor_configuration",
      strength: "approved_configuration",
      subject: getMonitorSubject(monitor),
      teamId: access.teamId,
      userScope: "workspace",
    }));
    const refreshSchedule = getRefreshSchedule({
      autoUpdate: monitor.Chart?.autoUpdate,
      Project: monitor.Project,
    });
    if (refreshSchedule.automatic) {
      signals.push(buildSignal({
        decision: {
          automatic: true,
          intervalSeconds: refreshSchedule.intervalSeconds,
        },
        occurredAt: monitor.updatedAt,
        projectId: monitor.project_id,
        signalKey: `${monitor.id}:refresh`,
        signalType: "metric_refresh_schedule",
        strength: "weak_operational",
        subject: getMonitorSubject(monitor),
        teamId: access.teamId,
        userScope: "workspace",
      }));
    }
  });
  subscriptions.forEach((subscription) => {
    signals.push(buildSignal({
      decision: {
        cadence: subscription.cadence,
        contentMode: subscription.content_mode,
        localDeliveryTime: subscription.local_delivery_time,
        timezone: subscription.timezone,
      },
      occurredAt: subscription.updatedAt,
      projectId: subscription.project_id,
      signalKey: subscription.id,
      signalType: "kpi_review_configuration",
      strength: "approved_configuration",
      subject: {
        monitorId: subscription.monitor_id,
        subscriptionId: subscription.id,
      },
      teamId: access.teamId,
    }));
  });
  pins.forEach((pin) => {
    signals.push(buildSignal({
      decision: { attention: "pinned" },
      occurredAt: pin.updatedAt,
      projectId: pin.project_id,
      signalKey: pin.id,
      signalType: "dashboard_pin",
      strength: "weak_attention",
      subject: { projectId: pin.project_id },
      teamId: access.teamId,
    }));
  });
  audits.forEach((audit) => {
    const monitor = audit.action_type.startsWith("metric_monitor.")
      ? monitorsById.get(`${audit.resource_id}`)
      : null;
    signals.push(buildSignal({
      decision: {
        after: audit.after_values || {},
        before: audit.before_values || {},
        changedFields: audit.changed_fields || [],
      },
      occurredAt: audit.createdAt,
      projectId: audit.project_id,
      signalKey: audit.id,
      signalType: "orchestrator_action_audit",
      strength: audit.action_type.endsWith(".update")
        ? "explicit_correction"
        : "explicit_decision",
      subject: monitor
        ? getMonitorSubject(monitor)
        : {
          monitorId: audit.action_type.startsWith("metric_monitor")
            ? audit.resource_id
            : null,
        },
      teamId: access.teamId,
    }));
  });
  return signals;
}

async function getWorkspaceLearningProjection(access, options = {}) {
  const policy = getWorkspaceOrchestratorPolicy();
  if (!policy.learningRetrievalEnabled) {
    return { items: [], lowSample: true, truncated: false };
  }
  const limits = getContextLimits(options.limits);
  const maximumAgeDays = Math.min(Math.max(Number(options.maximumAgeDays) || 365, 1), 3650);
  const since = new Date(Date.now() - (maximumAgeDays * 24 * 60 * 60 * 1000));
  const sources = await readLearningSources(access, since);
  sources[4] = sources[4].filter((subscription) => {
    return isKpiReviewAccessible(subscription, access);
  });
  const applicable = filterApplicableSignals(
    projectLearningSignals(sources, access),
    options
  )
    .filter((signal) => policy.weakAttentionSignalsEnabled
      || !["weak_attention", "weak_operational"].includes(signal.strength))
    .sort(sortSignals);
  const items = [];
  let characters = 2;
  for (const signal of applicable) {
    const nextCharacters = JSON.stringify(signal).length + 1;
    if (items.length >= limits.learning
      || characters + nextCharacters > limits.learningCharacters) break;
    items.push(signal);
    characters += nextCharacters;
  }
  const hasWorkspaceAggregate = items.some((item) => item.strength === "workspace_aggregate");
  return {
    items,
    lowSample: !hasWorkspaceAggregate,
    truncated: items.length < applicable.length,
  };
}

module.exports = {
  buildSignal,
  buildSignalId,
  filterApplicableSignals,
  getWorkspaceLearningProjection,
  isKpiReviewAccessible,
  projectFeedback,
  projectLearningSignals,
  sortSignals,
};
