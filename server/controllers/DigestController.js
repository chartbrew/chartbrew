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
const { getNextDigestDelivery } = require("../modules/observations/digestSchedule");

const CADENCES = new Set(["daily", "weekly"]);
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

function serializeSubscription(subscription) {
  const inferredDeliveryStatus = subscription.last_delivery_status
    || (subscription.last_delivered_at ? "delivered" : null)
    || (subscription.last_noop_at ? "no_updates" : null);
  const scope = getSubscriptionScope(subscription);
  return {
    cadence: subscription.cadence,
    channel: subscription.channel,
    dayOfWeek: subscription.day_of_week || 1,
    deliveryDays: subscription.delivery_days,
    enabled: subscription.enabled,
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
  const timezone = data.timezone || "UTC";
  const localDeliveryTime = data.localDeliveryTime || "09:00";
  const dayOfWeek = Number(data.dayOfWeek) || 1;
  const deliveryDays = cadence === "daily" ? normalizeDeliveryDays(data.deliveryDays) : null;
  if (!CADENCES.has(cadence)) throw createHttpError("Choose daily or weekly", 400);
  if (!TIME_PATTERN.test(localDeliveryTime)) {
    throw createHttpError("Choose a valid delivery time", 400);
  }
  if (!DateTime.now().setZone(timezone).isValid) {
    throw createHttpError("Choose a valid timezone", 400);
  }
  if (cadence === "weekly" && (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7)) {
    throw createHttpError("Choose a valid delivery day", 400);
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
    day_of_week: cadence === "weekly" ? dayOfWeek : 1,
    delivery_days: deliveryDays,
    enabled: data.enabled !== false,
    local_delivery_time: localDeliveryTime,
    monitor_id: data.monitorId || null,
    project_id: data.projectId || null,
    timezone,
  };
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
        attributes: ["id", "name", "project_id"],
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
        id: monitor.id,
        name: monitor.name,
        projectId: monitor.project_id,
        projectName: monitor.Project?.name || null,
      })),
      projects: projects.map((project) => ({ id: project.id, name: project.name })),
      recipient: user ? { email: user.email, name: user.name } : null,
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
    if (!user?.email) throw createHttpError("Add an email address before scheduling a summary", 400);
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
      throw createHttpError("You can schedule up to 10 summaries", 400);
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
    if (!subscription) throw createHttpError("Summary schedule not found", 404);
    return subscription;
  }

  async update(access, subscriptionId, data) {
    const subscription = await this.find(access, subscriptionId);
    const values = await validateSubscription(access, {
      cadence: data.cadence ?? subscription.cadence,
      dayOfWeek: data.dayOfWeek ?? subscription.day_of_week,
      deliveryDays: data.deliveryDays !== undefined
        ? data.deliveryDays
        : subscription.delivery_days,
      enabled: data.enabled ?? subscription.enabled,
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
    const observationController = new ObservationController();
    const homeController = new HomeController();
    const [activity, health, user, team] = await Promise.all([
      observationController.list(access, {
        limit: 50,
        project_id: digest.project_id || undefined,
        status: "open",
      }),
      homeController.getDataHealth(access, healthProjectId),
      db.User.findByPk(access.userId, { attributes: ["email", "name"] }),
      db.Team.findByPk(access.teamId, { attributes: ["name"] }),
    ]);
    const lastAttemptAt = digest.last_delivered_at || digest.last_noop_at;
    const defaultWindowDays = digest.cadence === "weekly" ? 7 : 1;
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
        healthItems: health.items,
        observations,
        recipient: user?.email || null,
        recipientName: user?.name || null,
        scopeName: digest.MetricMonitor?.name
          || digest.Project?.name
          || "All accessible dashboards",
        teamName: team?.name || "your workspace",
      },
      observations,
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
      healthCount: content.health.count,
      html: await mail.renderObservationDigest(content.mailData),
      observationCount: content.observations.length,
    };
  }

  async deliver(access, subscription, { isTest = false } = {}) {
    const digest = subscription.User ? subscription : await this.find(access, subscription.id);
    const content = await this.buildContent(access, digest);
    const { health, observations, user } = content;
    if (!isTest && observations.length === 0 && health.count === 0) {
      await digest.update({
        last_attempted_at: new Date(),
        last_delivery_status: "no_updates",
        last_noop_at: new Date(),
      });
      return { delivered: false, empty: true };
    }
    if (!user?.email) throw createHttpError("Add an email address before scheduling a summary", 400);
    await mail.sendObservationDigest(content.mailData);
    if (!isTest) {
      await digest.update({
        last_attempted_at: new Date(),
        last_delivered_at: new Date(),
        last_delivery_status: "delivered",
      });
    }
    return { delivered: true, empty: observations.length === 0 && health.count === 0 };
  }

  async sendTest(access, subscriptionId) {
    const subscription = await this.find(access, subscriptionId);
    return this.deliver(access, subscription, { isTest: true });
  }
}

module.exports = DigestController;
module.exports.serializeSubscription = serializeSubscription;
module.exports.validateSubscription = validateSubscription;
