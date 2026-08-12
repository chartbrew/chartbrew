const { Op } = require("sequelize");

const db = require("../models/models");
const DigestController = require("./DigestController");
const { createHttpError, getProjectScope } = require("../modules/observations/access");

const { isSubscriptionAccessible } = DigestController;

function parseLimit(value, fallback = 200, maximum = 1000) {
  const parsed = Number.parseInt(value, 10);
  return Math.min(Math.max(Number.isInteger(parsed) ? parsed : fallback, 1), maximum);
}

function getSince(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createHttpError("Choose a valid start date", 400);
  return date;
}

function assertOwnerAuditAccess(access) {
  if (!access.canConfigureTeam) throw createHttpError("Access denied", 403);
}

function serializeActionAudit(audit) {
  return {
    actionType: audit.action_type,
    actorUserId: audit.actor_user_id,
    after: audit.after_values || {},
    authorityType: audit.authority_type,
    before: audit.before_values || {},
    changedFields: audit.changed_fields || [],
    completedAt: audit.completed_at,
    createdAt: audit.createdAt,
    failureCode: audit.failure_code,
    actor: audit.actor ? {
      email: audit.actor.email,
      name: audit.actor.name,
    } : null,
    projectName: audit.Project?.name || null,
    projectId: audit.project_id,
    resourceId: audit.resource_id,
    resourceType: audit.resource_type,
    source: audit.source,
    status: audit.status,
  };
}

function serializeActionAuditForView(audit) {
  return {
    actionType: audit.action_type,
    actor: audit.actor ? {
      email: audit.actor.email,
      name: audit.actor.name,
    } : null,
    changedFields: audit.changed_fields || [],
    completedAt: audit.completed_at,
    createdAt: audit.createdAt,
    projectName: audit.Project?.name || null,
    status: audit.status,
  };
}

class WorkspaceLearningController {
  async actionAudit(access, query = {}) {
    assertOwnerAuditAccess(access);
    const since = getSince(query.since);
    const limit = parseLimit(query.limit);
    const where = { team_id: access.teamId };
    if (since) where.createdAt = { [Op.gte]: since };
    const rows = await db.OrchestratorActionAudit.findAll({
      include: [{
        as: "actor",
        attributes: ["email", "name"],
        model: db.User,
        required: false,
      }, {
        attributes: ["name"],
        model: db.Project,
        required: false,
      }],
      limit: limit + 1,
      order: [["createdAt", "DESC"]],
      where,
    });
    return {
      items: rows.slice(0, limit).map(serializeActionAuditForView),
      truncated: rows.length > limit,
    };
  }

  async egressAudit(access, query = {}) {
    assertOwnerAuditAccess(access);
    const since = getSince(query.since);
    const limit = parseLimit(query.limit);
    const where = {
      context_manifest: { [Op.ne]: null },
      model: { [Op.ne]: "deterministic" },
      team_id: access.teamId,
    };
    if (since) where.createdAt = { [Op.gte]: since };
    const rows = await db.AiUsage.findAll({
      attributes: ["context_manifest", "createdAt", "id", "purpose"],
      limit: limit + 1,
      order: [["createdAt", "DESC"]],
      where,
    });
    return {
      items: rows.slice(0, limit).map((row) => ({
        contextManifest: row.context_manifest,
        createdAt: row.createdAt,
        purpose: row.purpose,
      })),
      truncated: rows.length > limit,
    };
  }

  async export(access, query = {}) {
    const ownerExport = access.canConfigureTeam && query.scope !== "personal";
    const userWhere = ownerExport ? {} : { user_id: access.userId };
    const projectScope = access.allProjects ? {} : getProjectScope(access);
    const limit = parseLimit(query.limit, 1000, 5000);
    const observationWhere = {
      team_id: access.teamId,
      ...projectScope,
    };
    const [feedback, preferences, reviews] = await Promise.all([
      db.ObservationFeedback.findAll({
        attributes: ["observation_id", "reason_code", "updatedAt", "user_id", "verdict"],
        include: [{
          attributes: [],
          model: db.Observation,
          required: true,
          where: observationWhere,
        }],
        limit,
        order: [["updatedAt", "DESC"]],
        where: userWhere,
      }),
      db.ObservationPreference.findAll({
        attributes: [
          "dismissed_at", "observation_id", "read_at", "saved_at", "snoozed_until",
          "updatedAt", "user_id",
        ],
        include: [{
          attributes: [],
          model: db.Observation,
          required: true,
          where: observationWhere,
        }],
        limit,
        order: [["updatedAt", "DESC"]],
        where: userWhere,
      }),
      db.ObservationDigestSubscription.findAll({
        include: ownerExport ? [] : [{
          attributes: ["project_id"],
          model: db.MetricMonitor,
          required: false,
        }],
        limit,
        order: [["updatedAt", "DESC"]],
        where: {
          team_id: access.teamId,
          ...(ownerExport ? {} : { user_id: access.userId }),
        },
      }),
    ]);
    const visibleReviews = ownerExport
      ? reviews
      : reviews.filter((review) => isSubscriptionAccessible(review, access));

    let ownerData = {
      actionAudits: [],
      aiContextManifests: [],
      monitorConfigurations: [],
      recommendationDismissals: [],
    };
    if (ownerExport) {
      const [audits, manifests, monitors, dismissals] = await Promise.all([
        db.OrchestratorActionAudit.findAll({
          limit,
          order: [["createdAt", "DESC"]],
          where: { team_id: access.teamId },
        }),
        db.AiUsage.findAll({
          attributes: ["context_manifest", "createdAt", "id", "purpose"],
          limit,
          order: [["createdAt", "DESC"]],
          where: {
            context_manifest: { [Op.ne]: null },
            team_id: access.teamId,
          },
        }),
        db.MetricMonitor.findAll({
          attributes: [
            "baseline_policy", "binding_key", "id", "importance", "is_active", "metric_spec",
            "name", "project_id", "publication_policy", "updatedAt",
          ],
          limit,
          order: [["updatedAt", "DESC"]],
          where: { team_id: access.teamId },
        }),
        db.MetricRecommendationDismissal.findAll({
          attributes: [
            "binding_key", "chart_id", "dismissal_type", "dismissed_by", "expires_at", "id",
            "project_id", "updatedAt",
          ],
          limit,
          order: [["updatedAt", "DESC"]],
          where: { team_id: access.teamId },
        }),
      ]);
      ownerData = {
        actionAudits: audits.map(serializeActionAudit),
        aiContextManifests: manifests.map((row) => ({
          contextManifest: row.context_manifest,
          createdAt: row.createdAt,
          id: row.id,
          purpose: row.purpose,
        })),
        monitorConfigurations: monitors.map((monitor) => ({
          active: monitor.is_active,
          comparison: monitor.baseline_policy,
          id: monitor.id,
          importance: monitor.importance,
          metric: monitor.metric_spec,
          name: monitor.name,
          projectId: monitor.project_id,
          threshold: monitor.publication_policy,
          updatedAt: monitor.updatedAt,
        })),
        recommendationDismissals: dismissals.map((dismissal) => ({
          chartId: dismissal.chart_id,
          dismissalType: dismissal.dismissal_type,
          dismissedBy: dismissal.dismissed_by,
          expiresAt: dismissal.expires_at,
          id: dismissal.id,
          projectId: dismissal.project_id,
          updatedAt: dismissal.updatedAt,
        })),
      };
    }

    return {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      observationFeedback: feedback.map((row) => ({
        observationId: row.observation_id,
        reasonCode: row.reason_code,
        updatedAt: row.updatedAt,
        userId: row.user_id,
        verdict: row.verdict,
      })),
      observationPreferences: preferences.map((row) => ({
        dismissedAt: row.dismissed_at,
        observationId: row.observation_id,
        readAt: row.read_at,
        savedAt: row.saved_at,
        snoozedUntil: row.snoozed_until,
        updatedAt: row.updatedAt,
        userId: row.user_id,
      })),
      scope: ownerExport ? "workspace" : "personal",
      kpiReviews: visibleReviews.map((review) => ({
        cadence: review.cadence,
        contentMode: review.content_mode,
        dayOfMonth: review.day_of_month,
        dayOfWeek: review.day_of_week,
        deliveryDays: review.delivery_days,
        enabled: review.enabled,
        evaluationWaitMinutes: review.evaluation_wait_minutes,
        id: review.id,
        localDeliveryTime: review.local_delivery_time,
        monitorId: review.monitor_id,
        projectId: review.project_id,
        timezone: review.timezone,
        updatedAt: review.updatedAt,
        userId: review.user_id,
      })),
      ...ownerData,
    };
  }
}

module.exports = WorkspaceLearningController;
module.exports.assertOwnerAuditAccess = assertOwnerAuditAccess;
module.exports.serializeActionAudit = serializeActionAudit;
