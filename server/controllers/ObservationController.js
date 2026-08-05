const { Op } = require("sequelize");

const db = require("../models/models");
const {
  assertCanEditProject,
  createHttpError,
  getProjectScope,
} = require("../modules/observations/access");
const { runDriverAnalysis } = require("../modules/observations/driverAnalysis");
const { formatObservationText } = require("../modules/observations/formatObservation");
const { getValueFormat } = require("../modules/observations/valueFormat");
const {
  getObservationImpact,
  normalizeDesiredDirection,
} = require("../modules/observations/metricDirection");

const FEEDBACK_VERDICTS = new Set(["not_relevant", "relevant", "unsure"]);
const FEEDBACK_REASONS = new Set([
  "already_known",
  "clear_and_useful",
  "expected_change",
  "incorrect_context",
  "not_actionable",
  "too_small",
]);

function getPreference(observation) {
  return observation.ObservationPreferences?.[0] || null;
}

function serializePreference(preference) {
  return {
    dismissedAt: preference?.dismissed_at || null,
    readAt: preference?.read_at || null,
    savedAt: preference?.saved_at || null,
    snoozedUntil: preference?.snoozed_until || null,
  };
}

function getFeedback(observation) {
  return observation.ObservationFeedbacks?.[0] || null;
}

function serializeFeedback(feedback) {
  if (!feedback) return null;
  return {
    reasonCode: feedback.reason_code || null,
    verdict: feedback.verdict,
  };
}

function serializeMonitor(monitor) {
  if (!monitor) return null;
  return {
    active: monitor.is_active,
    desiredDirection: normalizeDesiredDirection(monitor.metric_spec?.desiredDirection),
    id: monitor.id,
    importance: monitor.importance,
    kind: monitor.kind,
    lastSampledAt: monitor.last_sampled_at,
    minimumSamples: monitor.minimum_samples,
    name: monitor.name,
    status: monitor.status,
    statusReason: monitor.status_reason,
    valueFormat: getValueFormat(monitor.metric_spec),
    comparisonMethod: monitor.baseline_policy?.type || null,
  };
}

function serializeObservation(observation, options = {}) {
  const preference = getPreference(observation);
  const displayText = observation.MetricMonitor
    ? formatObservationText(observation.MetricMonitor, {
      absoluteDelta: Number(observation.absolute_delta),
      baselineValue: Number(observation.baseline_value),
      currentValue: Number(observation.current_value),
      direction: observation.direction,
      relativeDelta: Number(observation.relative_delta),
    })
    : null;
  const desiredDirection = normalizeDesiredDirection(
    observation.MetricMonitor?.metric_spec?.desiredDirection
  );
  const response = {
    absoluteDelta: observation.absolute_delta,
    baselineValue: observation.baseline_value,
    chart: observation.Chart ? {
      id: observation.Chart.id,
      name: observation.Chart.name,
    } : null,
    comparisonPeriod: {
      end: observation.comparison_period_end,
      start: observation.comparison_period_start,
    },
    confidence: observation.confidence,
    currentPeriod: {
      end: observation.current_period_end,
      start: observation.current_period_start,
    },
    currentValue: observation.current_value,
    direction: observation.direction,
    feedback: serializeFeedback(getFeedback(observation)),
    firstDetectedAt: observation.first_detected_at,
    id: observation.id,
    impact: getObservationImpact(desiredDirection, observation.direction),
    lastDetectedAt: observation.last_detected_at,
    monitor: serializeMonitor(observation.MetricMonitor),
    preference: serializePreference(preference),
    project: observation.Project ? {
      id: observation.Project.id,
      name: observation.Project.name,
    } : null,
    relativeDelta: observation.relative_delta,
    resolvedAt: observation.resolved_at,
    severity: observation.severity,
    status: observation.status,
    summary: displayText?.summary || observation.summary,
    title: displayText?.title || observation.title,
    unit: observation.unit,
  };
  if (options.includeEvidence) response.evidence = observation.evidence;
  return response;
}

function getIncludes(userId) {
  return [
    { model: db.Chart, attributes: ["id", "name"], required: false },
    { model: db.Project, attributes: ["id", "name"], required: false },
    {
      model: db.MetricMonitor,
      attributes: [
        "dataset_id",
        "id",
        "is_active",
        "importance",
        "kind",
        "last_sampled_at",
        "metric_spec",
        "minimum_samples",
        "name",
        "baseline_policy",
        "status",
        "status_reason",
      ],
      required: false,
    },
    {
      model: db.ObservationPreference,
      attributes: ["dismissed_at", "read_at", "saved_at", "snoozed_until"],
      required: false,
      where: { user_id: userId },
    },
    {
      model: db.ObservationFeedback,
      attributes: ["reason_code", "verdict"],
      required: false,
      where: { user_id: userId },
    },
  ];
}

class ObservationController {
  async countUnread(access) {
    return db.Observation.count({
      distinct: true,
      include: [{
        model: db.ObservationPreference,
        attributes: [],
        required: false,
        where: { user_id: access.userId },
      }],
      where: {
        status: "open",
        team_id: access.teamId,
        ...getProjectScope(access),
        "$ObservationPreferences.dismissed_at$": { [Op.is]: null },
        "$ObservationPreferences.read_at$": { [Op.is]: null },
        [Op.or]: [
          { "$ObservationPreferences.snoozed_until$": { [Op.is]: null } },
          { "$ObservationPreferences.snoozed_until$": { [Op.lte]: new Date() } },
        ],
      },
    });
  }

  async list(access, query = {}) {
    const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 30, 1), 50);
    const usesPagePagination = query.page !== undefined && query.page !== null;
    const page = usesPagePagination
      ? Math.max(Number.parseInt(query.page, 10) || 1, 1)
      : null;
    const where = {
      team_id: access.teamId,
      ...getProjectScope(access),
    };
    if (query.status) where.status = query.status;
    if (query.project_id) {
      const projectId = Number(query.project_id);
      if (!access.allProjects && !access.projectIds.includes(projectId)) {
        throw createHttpError("Access denied", 403);
      }
      where.project_id = projectId;
    }
    const search = `${query.search || ""}`.trim().slice(0, 100);
    if (search) {
      const searchOperator = db.sequelize.getDialect() === "postgres" ? Op.iLike : Op.like;
      where[Op.or] = [
        { title: { [searchOperator]: `%${search}%` } },
        { summary: { [searchOperator]: `%${search}%` } },
        { "$Project.name$": { [searchOperator]: `%${search}%` } },
        { "$Chart.name$": { [searchOperator]: `%${search}%` } },
      ];
    }
    if (query.cursor) {
      const cursor = new Date(query.cursor);
      if (!Number.isNaN(cursor.getTime())) {
        const cursorField = query.status === "resolved" ? "resolved_at" : "last_detected_at";
        where[cursorField] = { [Op.lt]: cursor };
      }
    }

    const [observations, total] = await Promise.all([
      db.Observation.findAll({
        include: getIncludes(access.userId),
        limit,
        offset: usesPagePagination ? (page - 1) * limit : undefined,
        order: query.status === "resolved"
          ? [["resolved_at", "DESC"], ["id", "ASC"]]
          : [["last_detected_at", "DESC"], ["id", "ASC"]],
        subQuery: !search,
        where,
      }),
      usesPagePagination ? db.Observation.count({
        distinct: true,
        include: search ? getIncludes(access.userId) : undefined,
        where,
      }) : Promise.resolve(null),
    ]);
    const lastObservation = observations[observations.length - 1];
    let nextCursor = null;
    if (observations.length === limit) {
      nextCursor = query.status === "resolved"
        ? lastObservation.resolved_at
        : lastObservation.last_detected_at;
    }
    return {
      items: observations.map((observation) => serializeObservation(observation)),
      nextCursor,
      page,
      pageSize: limit,
      total,
    };
  }

  async findById(access, observationId) {
    const observation = await db.Observation.findOne({
      include: getIncludes(access.userId),
      where: {
        id: observationId,
        team_id: access.teamId,
        ...getProjectScope(access),
      },
    });
    if (!observation) throw createHttpError("Change not found", 404);
    return observation;
  }

  async detail(access, observationId) {
    const observation = await this.findById(access, observationId);
    return serializeObservation(observation, { includeEvidence: true });
  }

  async updatePreference(access, observationId, data = {}) {
    await this.findById(access, observationId);
    const [preference] = await db.ObservationPreference.findOrCreate({
      where: {
        observation_id: observationId,
        user_id: access.userId,
      },
    });
    const values = {};
    if (typeof data.read === "boolean") values.read_at = data.read ? new Date() : null;
    if (typeof data.saved === "boolean") values.saved_at = data.saved ? new Date() : null;
    if (typeof data.dismissed === "boolean") {
      values.dismissed_at = data.dismissed ? new Date() : null;
    }
    if (data.snoozedUntil !== undefined) {
      const snoozedUntil = data.snoozedUntil ? new Date(data.snoozedUntil) : null;
      if (snoozedUntil && Number.isNaN(snoozedUntil.getTime())) {
        throw createHttpError("Choose a valid snooze time", 400);
      }
      values.snoozed_until = snoozedUntil;
    }
    await preference.update(values);
    return serializePreference(preference);
  }

  async feedback(access, observationId, data = {}) {
    await this.findById(access, observationId);
    if (!FEEDBACK_VERDICTS.has(data.verdict)) {
      throw createHttpError("Choose a feedback option", 400);
    }
    if (data.reasonCode && !FEEDBACK_REASONS.has(data.reasonCode)) {
      throw createHttpError("Choose a feedback reason", 400);
    }
    const reasonCode = data.reasonCode || null;
    const [feedback] = await db.ObservationFeedback.findOrCreate({
      where: {
        observation_id: observationId,
        user_id: access.userId,
      },
      defaults: {
        reason_code: reasonCode,
        verdict: data.verdict,
      },
    });
    if (feedback.verdict !== data.verdict || feedback.reason_code !== reasonCode) {
      await feedback.update({
        reason_code: reasonCode,
        verdict: data.verdict,
      });
    }
    return serializeFeedback(feedback);
  }

  async setResolved(access, observationId, resolved) {
    const observation = await this.findById(access, observationId);
    assertCanEditProject(access, observation.project_id);
    await observation.update({
      resolved_at: resolved ? new Date() : null,
      status: resolved ? "resolved" : "open",
    });
    return serializeObservation(observation);
  }

  async investigate(access, observationId) {
    const observation = await this.findById(access, observationId);
    return {
      context: {
        id: observation.id,
        type: "observation",
      },
      suggestions: [
        "Compare this with the previous period",
        "Break this down by an available dimension",
        "Show the related dashboard",
      ],
    };
  }

  async drivers(access, observationId) {
    const observation = await this.findById(access, observationId);
    return runDriverAnalysis(observation);
  }
}

module.exports = ObservationController;
module.exports.FEEDBACK_REASONS = FEEDBACK_REASONS;
module.exports.FEEDBACK_VERDICTS = FEEDBACK_VERDICTS;
module.exports.getIncludes = getIncludes;
module.exports.serializeFeedback = serializeFeedback;
module.exports.serializeObservation = serializeObservation;
