const { Op } = require("sequelize");

const db = require("../models/models");
const ObservationController = require("./ObservationController");
const { isDatasetVisible } = require("../modules/workspaceContext/workspaceContextService");
const {
  PROJECT_EDITOR_ROLES,
  getProjectScope,
} = require("../modules/observations/access");

const FAILURE_STATUSES = new Set(["failed", "partial_failure"]);

function getHealthRunType(run) {
  if (run.connectionId && (run.errorStage === "connection" || run.entityType === "connection")) {
    return "connection";
  }
  if (run.datasetId && run.entityType === "dataset") return "dataset";
  if (run.chartId && run.entityType === "chart") return "chart";
  if (run.chartId) return "chart";
  if (run.datasetId) return "dataset";
  if (run.connectionId) return "connection";
  return "dashboard";
}

function getHealthRunKey(run) {
  const type = getHealthRunType(run);
  const idByType = {
    chart: run.chartId,
    connection: run.connectionId,
    dashboard: run.projectId,
    dataset: run.datasetId,
  };
  return idByType[type] ? `${type}:${idByType[type]}` : null;
}

function getHealthSuccessKeys(run) {
  return [
    run.chartId ? `chart:${run.chartId}` : null,
    run.connectionId ? `connection:${run.connectionId}` : null,
    run.datasetId ? `dataset:${run.datasetId}` : null,
    run.projectId ? `dashboard:${run.projectId}` : null,
  ].filter(Boolean);
}

function getEntityProjectIds(entity) {
  return Array.isArray(entity?.project_ids) ? entity.project_ids.map(Number) : [];
}

function canAccessHealthRun(run, access, projectId = null) {
  const entityProjectIds = [
    ...getEntityProjectIds(run.Connection),
    ...getEntityProjectIds(run.Dataset),
  ];
  const runProjectId = Number(run.projectId);
  if (projectId) {
    return runProjectId === Number(projectId) || entityProjectIds.includes(Number(projectId));
  }
  if (access.allProjects) return true;
  return access.projectIds.includes(runProjectId)
    || entityProjectIds.some((id) => access.projectIds.includes(id));
}

function buildRunHealthIssue(run, status = "active", resolvedAt = null) {
  const type = getHealthRunType(run);
  const project = run.Project ? { id: run.Project.id, name: run.Project.name } : null;
  const config = {
    chart: {
      action: run.chartId && run.projectId ? {
        label: "Open chart",
        path: `/dashboard/${run.projectId}/chart/${run.chartId}/edit`,
      } : null,
      entity: { id: run.chartId, name: run.Chart?.name || "Chart" },
      message: "The chart could not finish refreshing with the latest data.",
      title: `${run.Chart?.name || "A chart"} could not refresh`,
    },
    connection: {
      action: run.connectionId ? {
        label: "Check connection",
        path: `/connections/${run.connectionId}`,
      } : null,
      entity: { id: run.connectionId, name: run.Connection?.name || "Connection" },
      message: "Chartbrew could not retrieve data from this connection.",
      title: `${run.Connection?.name || "A connection"} could not be reached`,
    },
    dashboard: {
      action: run.projectId ? {
        label: "Open dashboard",
        path: `/dashboard/${run.projectId}`,
      } : null,
      entity: { id: run.projectId, name: run.Project?.name || "Dashboard" },
      message: "One or more items in the dashboard did not finish refreshing.",
      title: `${run.Project?.name || "A dashboard"} did not fully refresh`,
    },
    dataset: {
      action: run.datasetId ? {
        label: "Open dataset",
        path: `/datasets/${run.datasetId}`,
      } : null,
      entity: { id: run.datasetId, name: run.Dataset?.name || "Dataset" },
      message: "The dataset could not return usable data for its latest refresh.",
      title: `${run.Dataset?.name || "A dataset"} could not refresh`,
    },
  }[type];
  return {
    ...config,
    detectedAt: run.startedAt,
    id: `run:${getHealthRunKey(run)}:${run.id}`,
    project,
    resolvedAt,
    status,
    type,
  };
}

function buildMonitorHealthIssue(monitor) {
  const reasonCopy = {
    ambiguous_metric: "The latest chart result contains more than one value for this metric.",
    definition_changed: "The chart definition changed and the metric needs to be reviewed.",
    incomplete_data: "The latest data is incomplete, so Chartbrew could not evaluate this metric.",
    initial_evaluation_failed: "The data could not be evaluated when this metric was created.",
    metric_not_found: "The metric no longer matches the chart definition.",
    no_data: "The latest refresh returned no values for this metric.",
    unsupported_metric: "The chart no longer has a metric Chartbrew can evaluate.",
  };
  const action = monitor.dataset_id && !monitor.chart_id
    ? { label: "Open dataset", path: `/datasets/${monitor.dataset_id}` }
    : { label: "Review metric", path: "/activity?tab=monitors" };
  return {
    action,
    detectedAt: monitor.last_sampled_at || monitor.updatedAt,
    entity: { id: monitor.id, name: monitor.name },
    id: `monitor:${monitor.id}`,
    message: reasonCopy[monitor.status_reason]
      || "Chartbrew cannot evaluate this metric with the latest available data.",
    project: monitor.Project ? { id: monitor.Project.id, name: monitor.Project.name } : null,
    resolvedAt: null,
    status: "active",
    title: `${monitor.name} could not be evaluated`,
    type: "monitor",
  };
}

function partitionRunHealth(runs) {
  const latestSuccess = new Map();
  const latestFailure = new Map();
  [...runs]
    .sort((left, right) => new Date(right.startedAt) - new Date(left.startedAt))
    .forEach((run) => {
    const key = getHealthRunKey(run);
    if (!key) return;
    if (run.status === "success") {
      getHealthSuccessKeys(run).forEach((successKey) => {
        if (!latestSuccess.has(successKey)) latestSuccess.set(successKey, run);
      });
    }
    if (FAILURE_STATUSES.has(run.status) && !latestFailure.has(key)) {
      latestFailure.set(key, run);
    }
    });
  const active = [];
  const resolved = [];
  latestFailure.forEach((run, key) => {
    const recovery = latestSuccess.get(key);
    if (recovery && new Date(recovery.startedAt) > new Date(run.startedAt)) {
      resolved.push(buildRunHealthIssue(run, "resolved", recovery.startedAt));
    } else {
      active.push(buildRunHealthIssue(run));
    }
  });
  return { active, resolved };
}

const IMPACT_RANK = { negative: 2, neutral: 1, positive: 0 };
const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };
const HOME_ATTENTION_LIMIT = 8;

function rankObservations(left, right) {
  const impactDifference = (IMPACT_RANK[right.impact] || 0) - (IMPACT_RANK[left.impact] || 0);
  if (impactDifference !== 0) return impactDifference;
  const severityDifference = (SEVERITY_RANK[right.severity] || 0)
    - (SEVERITY_RANK[left.severity] || 0);
  if (severityDifference !== 0) return severityDifference;
  const importanceDifference = (right.monitor?.importance || 1) - (left.monitor?.importance || 1);
  if (importanceDifference !== 0) return importanceDifference;
  return new Date(right.lastDetectedAt) - new Date(left.lastDetectedAt);
}

function prioritizeHomeAttention(observations, dataHealthCount, limit = HOME_ATTENTION_LIMIT) {
  const safeLimit = Math.max(Number(limit) || HOME_ATTENTION_LIMIT, 1);
  const dataHealthSlots = dataHealthCount > 0 ? 1 : 0;
  const observationSlots = Math.max(safeLimit - dataHealthSlots, 0);
  const ranked = [...observations].sort(rankObservations);
  const needsAttention = ranked
    .filter((observation) => observation.impact !== "positive")
    .slice(0, observationSlots);
  const notableChanges = ranked
    .filter((observation) => observation.impact === "positive")
    .slice(0, Math.max(observationSlots - needsAttention.length, 0));
  return {
    needsAttention,
    notableChanges,
    observations: [...needsAttention, ...notableChanges],
    showDataHealth: dataHealthSlots > 0,
  };
}

function buildHomeOnboarding({
  connectionCount,
  datasetCount,
  memberCount,
  monitorCount,
  projects,
}) {
  const charts = projects.flatMap((project) => project.Charts || []);
  return {
    dashboardId: projects[0]?.id || null,
    milestones: {
      automaticUpdates: projects.some((project) => project.updateSchedule?.frequency)
        || charts.some((chart) => Number(chart.autoUpdate) > 0),
      chart: charts.length > 0,
      connection: connectionCount > 0,
      dataset: datasetCount > 0,
      sharedDashboard: projects.some((project) => project.public),
      teammate: memberCount > 1,
      watchedMetric: monitorCount > 0,
    },
  };
}

class HomeController {
  async getOnboarding(access, monitorCount) {
    const [connectionCount, datasetCount, memberCount, projects] = await Promise.all([
      access.canConfigureTeam
        ? db.Connection.count({ where: { team_id: access.teamId } })
        : null,
      access.allProjects
        ? db.Dataset.count({ where: { draft: false, team_id: access.teamId } })
        : db.Dataset.findAll({
          attributes: ["project_ids"],
          where: { draft: false, team_id: access.teamId },
        }).then((items) => items.filter((dataset) => isDatasetVisible(dataset, access)).length),
      access.canConfigureTeam ? db.TeamRole.count({ where: { team_id: access.teamId } }) : 0,
      db.Project.findAll({
        attributes: ["id", "public", "updateSchedule"],
        include: [{
          model: db.Chart,
          attributes: ["autoUpdate", "id"],
          required: false,
          where: { draft: false },
        }],
        order: [["id", "ASC"]],
        where: { ghost: false, team_id: access.teamId, ...getProjectScope(access, "id") },
      }),
    ]);
    return buildHomeOnboarding({
      connectionCount,
      datasetCount,
      memberCount,
      monitorCount,
      projects,
    });
  }

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
        attributes: ["createdAt", "id", "trigger"],
        limit: 1,
        order: [["createdAt", "DESC"]],
        separate: true,
      }],
      limit: 50,
      order: [["updatedAt", "DESC"]],
    });

    return alerts.map((alert) => {
      const latestEvent = alert.events?.[0] || null;
      const triggerItems = Array.isArray(latestEvent?.trigger) ? latestEvent.trigger : [];
      return {
        active: alert.active,
        chart: {
          id: alert.Chart.id,
          name: alert.Chart.name,
        },
        id: alert.id,
        lastTriggeredAt: latestEvent?.createdAt || null,
        lastTriggeredValues: triggerItems
          .filter((item) => item?.value !== null && item?.value !== undefined && item?.value !== "")
          .slice(0, 3)
          .map((item) => ({
            label: item.seriesLabel || item.label || null,
            value: item.value,
          })),
        oneTime: alert.oneTime,
        project: {
          id: alert.Chart.Project.id,
          name: alert.Chart.Project.name,
        },
        rules: alert.rules || {},
        type: alert.type,
      };
    });
  }

  async getDataHealth(access, projectId = null) {
    const since = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    const [runs, monitorIssues] = await Promise.all([
      db.UpdateRun.findAll({
        include: [{
          model: db.Chart,
          attributes: ["id", "name"],
          required: false,
        }, {
          model: db.Connection,
          attributes: ["id", "name", "project_ids"],
          required: false,
        }, {
          model: db.Dataset,
          attributes: ["id", "name", "project_ids"],
          required: false,
        }, {
          model: db.Project,
          attributes: ["id", "name"],
          required: false,
        }],
        limit: 500,
        order: [["startedAt", "DESC"]],
        where: {
          startedAt: { [Op.gte]: since },
          status: { [Op.in]: ["failed", "partial_failure", "success"] },
          teamId: access.teamId,
        },
      }),
      db.MetricMonitor.findAll({
        attributes: [
          "chart_id", "dataset_id", "id", "last_sampled_at", "name", "project_id", "status",
          "status_reason", "updatedAt",
        ],
        include: [{ model: db.Project, attributes: ["id", "name"], required: false }],
        where: {
          is_active: true,
          status: { [Op.in]: ["ineligible", "waiting_for_data"] },
          team_id: access.teamId,
          ...(projectId ? { project_id: projectId } : getProjectScope(access)),
        },
      }),
    ]);
    const visibleRuns = runs.filter((run) => canAccessHealthRun(run, access, projectId));
    const runHealth = partitionRunHealth(visibleRuns);
    const active = [...monitorIssues.map(buildMonitorHealthIssue), ...runHealth.active];
    const resolved = runHealth.resolved;
    active.sort((left, right) => new Date(right.detectedAt) - new Date(left.detectedAt));
    resolved.sort((left, right) => new Date(right.resolvedAt) - new Date(left.resolvedAt));

    return {
      active,
      count: active.length,
      items: active.slice(0, 5),
      resolved,
    };
  }

  async getActivityCounts(access) {
    const observationController = new ObservationController();
    const [changes, dataHealth] = await Promise.all([
      observationController.countUnread(access),
      this.getDataHealth(access),
    ]);
    return {
      changes,
      dataHealth: dataHealth.count,
      total: changes + dataHealth.count,
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
    const [
      changes,
      dataHealth,
      dashboards,
      monitors,
      unreadChanges,
    ] = await Promise.all([
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
    const visibleObservations = changes.items.filter((item) => {
      if (item.preference.dismissedAt) return false;
      return !item.preference.snoozedUntil || new Date(item.preference.snoozedUntil) <= now;
    });
    const attention = prioritizeHomeAttention(visibleObservations, dataHealth.count);
    const observations = attention.observations;
    const setup = await this.getOnboarding(access, monitors.length);
    const content = {
      canConfigureTeam: access.canConfigureTeam,
      hasConnection: access.canConfigureTeam ? setup.milestones.connection : null,
      hasDataset: setup.milestones.dataset,
      hasChart: setup.milestones.chart,
    };
    let setupState = "active";
    if (monitors.length === 0) {
      if (!(access.allProjects || PROJECT_EDITOR_ROLES.has(access.role))) {
        setupState = "waiting_for_metrics";
      } else if (access.canConfigureTeam && !content.hasConnection) {
        setupState = "connect_data";
      } else if (!content.hasDataset) {
        setupState = "create_dataset";
      } else {
        setupState = "watch_metric";
      }
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
    else if (attention.needsAttention.length === 0) setupState = "no_important_changes";

    return {
      dashboards,
      dataHealth: {
        ...dataHealth,
        showOnHome: attention.showDataHealth,
      },
      observations,
      needsAttention: attention.needsAttention,
      notableChanges: attention.notableChanges,
      content,
      onboarding: access.canConfigureTeam ? setup : null,
      setupState,
      hasWatchedMetric: monitors.length > 0,
      unreadCount: unreadChanges + dataHealth.count,
    };
  }

  async getActivity(access, query = {}) {
    const observationController = new ObservationController();
    return observationController.list(access, query);
  }
}

module.exports = HomeController;
module.exports.HOME_ATTENTION_LIMIT = HOME_ATTENTION_LIMIT;
module.exports.buildRunHealthIssue = buildRunHealthIssue;
module.exports.buildHomeOnboarding = buildHomeOnboarding;
module.exports.getHealthRunType = getHealthRunType;
module.exports.partitionRunHealth = partitionRunHealth;
module.exports.prioritizeHomeAttention = prioritizeHomeAttention;
module.exports.rankObservations = rankObservations;
