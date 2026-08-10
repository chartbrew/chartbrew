const { DateTime } = require("luxon");

const db = require("../models/models");
const mail = require("../modules/mail");
const HomeController = require("./HomeController");
const ObservationController = require("./ObservationController");
const {
  assertCanViewProject,
  createHttpError,
  getProjectScope,
} = require("../modules/observations/access");
const {
  getNextDigestDelivery,
  getScheduledTime,
} = require("../modules/observations/digestSchedule");
const {
  buildKpiReview,
  claimKpiReviewDelivery,
  completeKpiReviewDelivery,
  failKpiReviewDelivery,
  getDeliveryKey,
} = require("../modules/observations/kpiReview");

const CADENCES = new Set(["daily", "weekly", "monthly"]);
const CONTENT_MODES = new Set(["changes_only", "kpi_review"]);
const DELIVERY_DAYS = new Set([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
]);
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeDeliveryDays(deliveryDays) {
  if (deliveryDays === null || deliveryDays === undefined) return null;
  if (!Array.isArray(deliveryDays) || deliveryDays.length === 0) {
    throw createHttpError("Choose at least one delivery day", 400);
  }
  const normalized = [...new Set(deliveryDays.map((day) => `${day}`.toLowerCase()))];
  if (normalized.some((day) => !DELIVERY_DAYS.has(day))) {
    throw createHttpError("Choose valid delivery days", 400);
  }
  return normalized.length === DELIVERY_DAYS.size ? null : normalized;
}

function getSubscriptionScope(subscription) {
  if (subscription.monitor_id) {
    return {
      id: subscription.monitor_id,
      name: subscription.MetricMonitor?.name || "Watched metric",
      projectName: subscription.MetricMonitor?.Project?.name || null,
      type: "monitor",
    };
  }
  if (subscription.project_id) {
    return {
      id: subscription.project_id,
      name: subscription.Project?.name || "Dashboard",
      type: "project",
    };
  }
  return {
    id: null,
    name: "All accessible dashboards",
    type: "workspace",
  };
}

function getDefaultWindowDays(cadence) {
  if (cadence === "monthly") return 31;
  if (cadence === "weekly") return 7;
  return 1;
}

function serializeSubscription(subscription) {
  const inferredDeliveryStatus = subscription.last_delivery_status
    || (subscription.last_delivered_at ? "delivered" : null)
    || (subscription.last_noop_at ? "no_updates" : null);
  const scope = getSubscriptionScope(subscription);
  return {
    cadence: subscription.cadence,
    channel: subscription.channel,
    contentMode: subscription.content_mode || "kpi_review",
    dayOfMonth: subscription.day_of_month || 1,
    dayOfWeek: subscription.day_of_week || 1,
    deliveryDays: subscription.delivery_days,
    enabled: subscription.enabled,
    evaluationWaitMinutes: subscription.evaluation_wait_minutes || 120,
    id: subscription.id,
    lastDeliveredAt: subscription.last_delivered_at,
    lastDelivery: inferredDeliveryStatus ? {
      attemptedAt: subscription.last_attempted_at
        || subscription.last_delivered_at
        || subscription.last_noop_at,
      status: inferredDeliveryStatus,
    } : null,
    lastNoopAt: subscription.last_noop_at,
    localDeliveryTime: subscription.local_delivery_time,
    monitorId: subscription.monitor_id,
    projectId: subscription.project_id,
    recipient: subscription.User ? {
      email: subscription.User.email,
      name: subscription.User.name,
    } : null,
    scope,
    timezone: subscription.timezone,
    nextDeliveryAt: getNextDigestDelivery(subscription),
  };
}

function getSubscriptionIncludes() {
  return [{
    model: db.User,
    attributes: ["email", "name"],
    required: false,
  }, {
    model: db.Project,
    attributes: ["id", "name"],
    required: false,
  }, {
    model: db.MetricMonitor,
    attributes: ["id", "name"],
    required: false,
    include: [{ model: db.Project, attributes: ["id", "name"], required: false }],
  }];
}

async function validateSubscription(access, data = {}) {
  const cadence = data.cadence || "weekly";
  const contentMode = data.contentMode || "kpi_review";
  const timezone = data.timezone || "UTC";
  const localDeliveryTime = data.localDeliveryTime || "09:00";
  const dayOfWeek = Number(data.dayOfWeek) || 1;
  const dayOfMonth = Number(data.dayOfMonth) || 1;
  const evaluationWaitMinutes = data.evaluationWaitMinutes === undefined
    ? 120
    : Number(data.evaluationWaitMinutes);
  const deliveryDays = cadence === "daily" ? normalizeDeliveryDays(data.deliveryDays) : null;
  if (!CADENCES.has(cadence)) throw createHttpError("Choose daily, weekly, or monthly", 400);
  if (!CONTENT_MODES.has(contentMode)) {
    throw createHttpError("Choose a KPI review or changes only", 400);
  }
  if (!TIME_PATTERN.test(localDeliveryTime)) {
    throw createHttpError("Choose a valid delivery time", 400);
  }
  if (!DateTime.now().setZone(timezone).isValid) {
    throw createHttpError("Choose a valid timezone", 400);
  }
  if (cadence === "weekly" && (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7)) {
    throw createHttpError("Choose a valid delivery day", 400);
  }
  if (cadence === "monthly"
    && (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31)) {
    throw createHttpError("Choose a valid day of the month", 400);
  }
  if (!Number.isInteger(evaluationWaitMinutes)
    || evaluationWaitMinutes < 0
    || evaluationWaitMinutes > 1440) {
    throw createHttpError("Choose a wait time from 0 to 1440 minutes", 400);
  }
  if (data.projectId) {
    assertCanViewProject(access, data.projectId);
    const project = await db.Project.findOne({
      attributes: ["id"],
      where: {
        ghost: false,
        id: data.projectId,
        team_id: access.teamId,
      },
    });
    if (!project) throw createHttpError("Dashboard not found", 404);
  }
  if (data.monitorId) {
    const monitor = await db.MetricMonitor.findOne({
      attributes: ["id", "project_id"],
      where: {
        id: data.monitorId,
        team_id: access.teamId,
        ...getProjectScope(access),
      },
    });
    if (!monitor) throw createHttpError("Watched metric not found", 404);
    if (data.projectId && Number(data.projectId) !== Number(monitor.project_id)) {
      throw createHttpError("Choose a watched metric from this dashboard", 400);
    }
  }
  return {
    cadence,
    channel: "email",
    content_mode: contentMode,
    day_of_month: cadence === "monthly" ? dayOfMonth : 1,
    day_of_week: cadence === "weekly" ? dayOfWeek : 1,
    delivery_days: deliveryDays,
    enabled: data.enabled !== false,
    evaluation_wait_minutes: evaluationWaitMinutes,
    local_delivery_time: localDeliveryTime,
    monitor_id: data.monitorId || null,
    project_id: data.projectId || null,
    timezone,
  };
}

function getRecommendedCadence(monitors) {
  const periods = monitors.map((monitor) => (
    monitor.baseline_policy?.comparisonPeriod
  )).filter(Boolean);
  if (periods.includes("day")) return "daily";
  if (periods.includes("week")) return "weekly";
  if (periods.length > 0 && periods.every((period) => period === "month")) return "monthly";
  return "weekly";
}

function shouldHoldKpiReview(digest, content, now) {
  if ((digest.content_mode || "kpi_review") !== "kpi_review"
    || !content.waitingMetrics.some((metric) => metric.settling)) return false;
  const localNow = DateTime.fromJSDate(now).setZone(digest.timezone);
  if (!localNow.isValid) return false;
  const waitUntil = getScheduledTime(digest, localNow).plus({
    minutes: Number(digest.evaluation_wait_minutes) || 0,
  });
  return localNow < waitUntil;
}

class DigestController {
  async options(access) {
    const [user, projects, monitors] = await Promise.all([
      db.User.findByPk(access.userId, { attributes: ["email", "name"] }),
      db.Project.findAll({
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
        where: {
          ghost: false,
          team_id: access.teamId,
          ...getProjectScope(access, "id"),
        },
      }),
      db.MetricMonitor.findAll({
        attributes: ["baseline_policy", "id", "name", "project_id"],
        include: [{ model: db.Project, attributes: ["id", "name"], required: false }],
        order: [["name", "ASC"]],
        where: {
          is_active: true,
          team_id: access.teamId,
          ...getProjectScope(access),
        },
      }),
    ]);
    return {
      channels: [{ id: "email", name: "Email" }],
      monitors: monitors.map((monitor) => ({
        comparisonPeriod: monitor.baseline_policy?.comparisonPeriod || null,
        id: monitor.id,
        name: monitor.name,
        projectId: monitor.project_id,
        projectName: monitor.Project?.name || null,
      })),
      projects: projects.map((project) => ({ id: project.id, name: project.name })),
      recipient: user ? { email: user.email, name: user.name } : null,
      recommendedCadence: getRecommendedCadence(monitors),
    };
  }

  async list(access) {
    const subscriptions = await db.ObservationDigestSubscription.findAll({
      include: getSubscriptionIncludes(),
      order: [["createdAt", "DESC"]],
      where: {
        team_id: access.teamId,
        user_id: access.userId,
      },
    });
    return subscriptions.map(serializeSubscription);
  }

  async create(access, data) {
    const values = await validateSubscription(access, data);
    const user = await db.User.findByPk(access.userId, { attributes: ["email"] });
    if (!user?.email) {
      throw createHttpError("Add an email address before scheduling a KPI review", 400);
    }
    const existing = await db.ObservationDigestSubscription.findOne({
      where: {
        channel: values.channel,
        monitor_id: values.monitor_id,
        project_id: values.project_id,
        team_id: access.teamId,
        user_id: access.userId,
      },
    });
    if (existing) {
      await existing.update(values);
      return this.find(access, existing.id).then(serializeSubscription);
    }
    const subscriptionCount = await db.ObservationDigestSubscription.count({
      where: { team_id: access.teamId, user_id: access.userId },
    });
    if (subscriptionCount >= 10) {
      throw createHttpError("You can schedule up to 10 KPI reviews", 400);
    }
    const subscription = await db.ObservationDigestSubscription.create({
      ...values,
      team_id: access.teamId,
      user_id: access.userId,
    });
    return this.find(access, subscription.id).then(serializeSubscription);
  }

  async find(access, subscriptionId) {
    const subscription = await db.ObservationDigestSubscription.findOne({
      include: getSubscriptionIncludes(),
      where: {
        id: subscriptionId,
        team_id: access.teamId,
        user_id: access.userId,
      },
    });
    if (!subscription) throw createHttpError("KPI review not found", 404);
    return subscription;
  }

  async update(access, subscriptionId, data) {
    const subscription = await this.find(access, subscriptionId);
    const values = await validateSubscription(access, {
      cadence: data.cadence ?? subscription.cadence,
      contentMode: data.contentMode ?? subscription.content_mode,
      dayOfMonth: data.dayOfMonth ?? subscription.day_of_month,
      dayOfWeek: data.dayOfWeek ?? subscription.day_of_week,
      deliveryDays: data.deliveryDays !== undefined
        ? data.deliveryDays
        : subscription.delivery_days,
      enabled: data.enabled ?? subscription.enabled,
      evaluationWaitMinutes: data.evaluationWaitMinutes
        ?? subscription.evaluation_wait_minutes,
      localDeliveryTime: data.localDeliveryTime ?? subscription.local_delivery_time,
      monitorId: data.monitorId !== undefined ? data.monitorId : subscription.monitor_id,
      projectId: data.projectId !== undefined ? data.projectId : subscription.project_id,
      timezone: data.timezone ?? subscription.timezone,
    });
    await subscription.update(values);
    return this.find(access, subscription.id).then(serializeSubscription);
  }

  async remove(access, subscriptionId) {
    const subscription = await this.find(access, subscriptionId);
    await subscription.destroy();
    return { removed: true };
  }

  async buildContent(access, digest) {
    if (digest.project_id) assertCanViewProject(access, digest.project_id);
    let healthProjectId = digest.project_id || null;
    if (digest.monitor_id) {
      const monitor = await db.MetricMonitor.findOne({
        attributes: ["id", "name", "project_id"],
        where: {
          id: digest.monitor_id,
          team_id: access.teamId,
          ...getProjectScope(access),
        },
      });
      if (!monitor) throw createHttpError("Watched metric not found", 404);
      healthProjectId = monitor.project_id;
    }
    const contentMode = digest.content_mode || "kpi_review";
    const observationController = new ObservationController();
    const homeController = new HomeController();
    const [activity, health, review, user, team] = await Promise.all([
      contentMode === "changes_only" ? observationController.list(access, {
        limit: 50,
        project_id: digest.project_id || undefined,
        status: "open",
      }) : { items: [] },
      homeController.getDataHealth(access, healthProjectId),
      contentMode === "kpi_review" ? buildKpiReview(access, digest) : {
        attentionItems: [],
        evaluationRecords: [],
        kpis: [],
        waitingMetrics: [],
      },
      db.User.findByPk(access.userId, { attributes: ["email", "name"] }),
      db.Team.findByPk(access.teamId, { attributes: ["name"] }),
    ]);
    const lastAttemptAt = digest.last_delivered_at || digest.last_noop_at;
    const defaultWindowDays = getDefaultWindowDays(digest.cadence);
    const changeCutoff = lastAttemptAt
      ? new Date(lastAttemptAt)
      : new Date(Date.now() - (defaultWindowDays * 24 * 60 * 60 * 1000));
    const observations = activity.items.filter((item) => {
      const matchesMonitor = !digest.monitor_id
        || item.monitor?.id === digest.monitor_id;
      return matchesMonitor && new Date(item.lastDetectedAt) > changeCutoff;
    });
    return {
      health,
      mailData: {
        attentionItems: review.attentionItems,
        contentMode,
        healthItems: health.items,
        kpis: review.kpis,
        observations,
        recipient: user?.email || null,
        recipientName: user?.name || null,
        scopeName: digest.MetricMonitor?.name
          || digest.Project?.name
          || "All accessible dashboards",
        teamName: team?.name || "your workspace",
        waitingMetrics: review.waitingMetrics,
      },
      observations,
      ...review,
      user,
    };
  }

  async preview(access, data) {
    const values = await validateSubscription(access, data);
    const [project, monitor] = await Promise.all([
      values.project_id ? db.Project.findByPk(values.project_id, { attributes: ["id", "name"] }) : null,
      values.monitor_id ? db.MetricMonitor.findOne({
        attributes: ["id", "name", "project_id"],
        include: [{ model: db.Project, attributes: ["id", "name"], required: false }],
        where: { id: values.monitor_id, team_id: access.teamId },
      }) : null,
    ]);
    const content = await this.buildContent(access, {
      ...values,
      MetricMonitor: monitor,
      Project: project,
      last_delivered_at: null,
      last_noop_at: null,
    });
    return {
      attentionCount: content.attentionItems.length,
      evaluationCount: content.kpis.length,
      healthCount: content.health.count,
      html: await mail.renderObservationDigest(content.mailData),
      observationCount: content.observations.length,
      waitingMetricCount: content.waitingMetrics.length,
    };
  }

  async deliver(access, subscription, {
    isTest = false,
    lateRetry = false,
    now = new Date(),
  } = {}) {
    const digest = subscription.User ? subscription : await this.find(access, subscription.id);
    const content = await this.buildContent(access, digest);
    let {
      evaluationRecords,
      kpis,
    } = content;
    const {
      attentionItems,
      health,
      observations,
      user,
      waitingMetrics,
    } = content;
    const isKpiReview = (digest.content_mode || "kpi_review") === "kpi_review";
    let claimedEvaluationRecords = [];
    if (!isTest && shouldHoldKpiReview(digest, content, now)) {
      return { deferred: true, delivered: false, empty: false };
    }
    if (!isTest && isKpiReview && evaluationRecords.length > 0) {
      if (!user?.email) {
        throw createHttpError("Add an email address before scheduling a KPI review", 400);
      }
      claimedEvaluationRecords = await claimKpiReviewDelivery(digest, evaluationRecords, now);
      if (claimedEvaluationRecords.length === 0) {
        return { delivered: false, empty: false, pending: true };
      }
      const claimedKeys = new Set(claimedEvaluationRecords.map(getDeliveryKey));
      evaluationRecords = claimedEvaluationRecords;
      kpis = kpis.filter((item) => claimedKeys.has(getDeliveryKey(item)));
      content.mailData.kpis = kpis;
    }
    if (!isTest
      && lateRetry
      && kpis.length === 0) {
      return { delivered: false, empty: false, pending: true };
    }
    const empty = attentionItems.length === 0
      && health.count === 0
      && kpis.length === 0
      && observations.length === 0
      && waitingMetrics.length === 0;
    if (!isTest && empty) {
      await digest.update({
        last_attempted_at: now,
        last_delivery_status: "no_updates",
        last_noop_at: now,
      });
      return { delivered: false, empty: true };
    }
    if (!user?.email) {
      throw createHttpError("Add an email address before scheduling a KPI review", 400);
    }
    try {
      await mail.sendObservationDigest(content.mailData);
    } catch (error) {
      if (claimedEvaluationRecords.length > 0) {
        try {
          await failKpiReviewDelivery(digest, claimedEvaluationRecords);
        } catch (claimError) {
          console.error(`[observations] Could not release KPI review delivery claims: ${claimError.message}`); // eslint-disable-line no-console
        }
      }
      throw error;
    }
    if (!isTest) {
      if (isKpiReview && claimedEvaluationRecords.length > 0) {
        try {
          await completeKpiReviewDelivery(digest, evaluationRecords, now);
        } catch (error) {
          console.error(`[observations] KPI review was sent but its delivery claim is still pending: ${error.message}`); // eslint-disable-line no-console
        }
      }
      const hasLateEvaluation = waitingMetrics.some((metric) => metric.settling);
      await digest.update({
        last_attempted_at: now,
        last_delivered_at: now,
        last_delivery_status: hasLateEvaluation ? "waiting_for_data" : "delivered",
      });
    }
    return { delivered: true, empty };
  }

  async sendTest(access, subscriptionId) {
    const subscription = await this.find(access, subscriptionId);
    return this.deliver(access, subscription, { isTest: true });
  }
}

module.exports = DigestController;
module.exports.getRecommendedCadence = getRecommendedCadence;
module.exports.serializeSubscription = serializeSubscription;
module.exports.shouldHoldKpiReview = shouldHoldKpiReview;
module.exports.validateSubscription = validateSubscription;
