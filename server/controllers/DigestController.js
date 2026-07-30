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

const CADENCES = new Set(["daily", "weekly"]);
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function serializeSubscription(subscription) {
  return {
    cadence: subscription.cadence,
    channel: subscription.channel,
    enabled: subscription.enabled,
    id: subscription.id,
    lastDeliveredAt: subscription.last_delivered_at,
    lastNoopAt: subscription.last_noop_at,
    localDeliveryTime: subscription.local_delivery_time,
    monitorId: subscription.monitor_id,
    projectId: subscription.project_id,
    timezone: subscription.timezone,
  };
}

async function validateSubscription(access, data = {}) {
  const cadence = data.cadence || "weekly";
  const timezone = data.timezone || "UTC";
  const localDeliveryTime = data.localDeliveryTime || "09:00";
  if (!CADENCES.has(cadence)) throw createHttpError("Choose daily or weekly", 400);
  if (!TIME_PATTERN.test(localDeliveryTime)) {
    throw createHttpError("Choose a valid delivery time", 400);
  }
  if (!DateTime.now().setZone(timezone).isValid) {
    throw createHttpError("Choose a valid timezone", 400);
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
    enabled: data.enabled !== false,
    local_delivery_time: localDeliveryTime,
    monitor_id: data.monitorId || null,
    project_id: data.projectId || null,
    timezone,
  };
}

class DigestController {
  async list(access) {
    const subscriptions = await db.ObservationDigestSubscription.findAll({
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
    const subscription = await db.ObservationDigestSubscription.create({
      ...values,
      team_id: access.teamId,
      user_id: access.userId,
    });
    return serializeSubscription(subscription);
  }

  async find(access, subscriptionId) {
    const subscription = await db.ObservationDigestSubscription.findOne({
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
      enabled: data.enabled ?? subscription.enabled,
      localDeliveryTime: data.localDeliveryTime ?? subscription.local_delivery_time,
      monitorId: data.monitorId !== undefined ? data.monitorId : subscription.monitor_id,
      projectId: data.projectId !== undefined ? data.projectId : subscription.project_id,
      timezone: data.timezone ?? subscription.timezone,
    });
    await subscription.update(values);
    return serializeSubscription(subscription);
  }

  async remove(access, subscriptionId) {
    const subscription = await this.find(access, subscriptionId);
    await subscription.destroy();
    return { removed: true };
  }

  async deliver(access, subscription, { isTest = false } = {}) {
    if (subscription.project_id) assertCanViewProject(access, subscription.project_id);
    let healthProjectId = subscription.project_id || null;
    if (subscription.monitor_id) {
      const monitor = await db.MetricMonitor.findOne({
        attributes: ["id", "project_id"],
        where: {
          id: subscription.monitor_id,
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
        project_id: subscription.project_id || undefined,
        status: "open",
      }),
      homeController.getDataHealth(access, healthProjectId),
      db.User.findByPk(access.userId, { attributes: ["email", "name"] }),
      db.Team.findByPk(access.teamId, { attributes: ["name"] }),
    ]);
    const lastAttemptAt = subscription.last_delivered_at || subscription.last_noop_at;
    const defaultWindowDays = subscription.cadence === "weekly" ? 7 : 1;
    const changeCutoff = lastAttemptAt
      ? new Date(lastAttemptAt)
      : new Date(Date.now() - (defaultWindowDays * 24 * 60 * 60 * 1000));
    const observations = activity.items.filter((item) => {
      const matchesMonitor = !subscription.monitor_id
        || item.monitor?.id === subscription.monitor_id;
      return matchesMonitor && new Date(item.lastDetectedAt) > changeCutoff;
    });
    if (!isTest && observations.length === 0 && health.count === 0) {
      await subscription.update({ last_noop_at: new Date() });
      return { delivered: false, empty: true };
    }
    if (!user?.email) throw createHttpError("Add an email address before scheduling a summary", 400);
    await mail.sendObservationDigest({
      healthItems: health.items,
      observations,
      recipient: user.email,
      recipientName: user.name,
      teamName: team?.name || "your workspace",
    });
    if (!isTest) {
      await subscription.update({ last_delivered_at: new Date() });
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
