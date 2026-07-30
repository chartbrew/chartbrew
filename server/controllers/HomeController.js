const { Op } = require("sequelize");

const db = require("../models/models");
const ObservationController = require("./ObservationController");
const {
  PROJECT_EDITOR_ROLES,
  getProjectScope,
} = require("../modules/observations/access");

function getHealthMessage(run) {
  if (run.chartId) return "A chart could not refresh";
  if (run.datasetId) return "A dataset could not refresh";
  return "A dashboard could not refresh";
}

class HomeController {
  async getAlerts(access) {
    const alerts = await db.Alert.findAll({
      include: [{
        model: db.Chart,
        attributes: ["id", "name", "project_id"],
        required: true,
        include: [{
          model: db.Project,
          attributes: ["id", "name"],
          required: true,
          where: {
            ghost: false,
            team_id: access.teamId,
            ...getProjectScope(access, "id"),
          },
        }],
      }, {
        model: db.AlertEvent,
        as: "events",
        attributes: ["createdAt", "id"],
        limit: 1,
        order: [["createdAt", "DESC"]],
        separate: true,
      }],
      limit: 50,
      order: [["updatedAt", "DESC"]],
    });

    return alerts.map((alert) => ({
      active: alert.active,
      chart: {
        id: alert.Chart.id,
        name: alert.Chart.name,
      },
      id: alert.id,
      lastTriggeredAt: alert.events?.[0]?.createdAt || null,
      oneTime: alert.oneTime,
      project: {
        id: alert.Chart.Project.id,
        name: alert.Chart.Project.name,
      },
      type: alert.type,
    }));
  }

  async getDataHealth(access, projectId = null) {
    const since = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    let projectScope = { [Op.in]: access.projectIds.length > 0 ? access.projectIds : [-1] };
    if (projectId) projectScope = Number(projectId);
    else if (access.allProjects) projectScope = { [Op.ne]: null };
    const failedRuns = await db.UpdateRun.findAll({
      limit: 20,
      order: [["startedAt", "DESC"]],
      where: {
        projectId: projectScope,
        startedAt: { [Op.gte]: since },
        status: "failed",
        teamId: access.teamId,
      },
    });
    const unresolved = (await Promise.all(failedRuns.map(async (run) => {
      const entityWhere = {
        startedAt: { [Op.gt]: run.startedAt },
        status: "success",
        teamId: access.teamId,
      };
      if (run.chartId) entityWhere.chartId = run.chartId;
      else if (run.datasetId) entityWhere.datasetId = run.datasetId;
      else if (run.projectId) entityWhere.projectId = run.projectId;
      else return null;

      const recovered = await db.UpdateRun.count({ where: entityWhere });
      if (recovered > 0) return null;
      return {
        chartId: run.chartId,
        datasetId: run.datasetId,
        detectedAt: run.startedAt,
        id: `${run.id}`,
        message: getHealthMessage(run),
        projectId: run.projectId,
      };
    }))).filter(Boolean);

    return {
      count: unresolved.length,
      items: unresolved.slice(0, 5),
    };
  }

  async getRecentDashboards(access) {
    const pins = await db.PinnedDashboard.findAll({
      attributes: ["project_id"],
      where: {
        team_id: access.teamId,
        user_id: access.userId,
      },
    });
    const pinnedIds = pins.map((pin) => pin.project_id);
    const projects = await db.Project.findAll({
      include: [{
        model: db.Chart,
        attributes: ["id"],
        required: false,
      }],
      limit: 12,
      order: [["lastUpdatedAt", "DESC"], ["updatedAt", "DESC"]],
      where: {
        ghost: false,
        team_id: access.teamId,
        ...getProjectScope(access, "id"),
      },
    });
    return projects
      .sort((left, right) => {
        return Number(pinnedIds.includes(right.id)) - Number(pinnedIds.includes(left.id));
      })
      .slice(0, 6)
      .map((project) => ({
        chartCount: project.Charts?.length || 0,
        id: project.id,
        lastUpdatedAt: project.lastUpdatedAt || project.updatedAt,
        name: project.name,
        pinned: pinnedIds.includes(project.id),
      }));
  }

  async getHome(access) {
    const observationController = new ObservationController();
    const [changes, dataHealth, dashboards, monitors, unreadChanges] = await Promise.all([
      observationController.list(access, { limit: 50, status: "open" }),
      this.getDataHealth(access),
      this.getRecentDashboards(access),
      db.MetricMonitor.findAll({
        attributes: ["id", "minimum_samples", "status"],
        where: {
          is_active: true,
          team_id: access.teamId,
          ...getProjectScope(access),
        },
      }),
      observationController.countUnread(access),
    ]);
    const now = new Date();
    const observations = changes.items.filter((item) => {
      if (item.preference.dismissedAt) return false;
      return !item.preference.snoozedUntil || new Date(item.preference.snoozedUntil) <= now;
    }).slice(0, 3);

    let setupState = "active";
    if (monitors.length === 0) {
      setupState = access.allProjects || PROJECT_EDITOR_ROLES.has(access.role)
        ? "watch_metric"
        : "waiting_for_metrics";
    }
    else if (dataHealth.count > 0) {
      setupState = "data_needs_attention";
    } else if (monitors.every((monitor) => monitor.status === "collecting")) {
      setupState = "collecting_baseline";
    } else if (monitors.every((monitor) => monitor.status !== "ready")) {
      setupState = monitors.some((monitor) => monitor.status === "ineligible")
        ? "metrics_need_review"
        : "waiting_for_data";
    }
    else if (observations.length === 0) setupState = "no_important_changes";

    if (access.canConfigureTeam) {
      const connectionCount = await db.Connection.count({
        where: { team_id: access.teamId },
      });
      if (connectionCount === 0) setupState = "connect_data";
    }

    return {
      dashboards,
      dataHealth,
      observations,
      setupState,
      unreadCount: unreadChanges + dataHealth.count,
    };
  }

  async getActivity(access, query = {}) {
    const observationController = new ObservationController();
    return observationController.list(access, query);
  }
}

module.exports = HomeController;
