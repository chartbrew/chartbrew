const { Op } = require("sequelize");

const db = require("../models/models");
const MonitorController = require("./MonitorController");
const {
  canEditProject,
  createHttpError,
  getProjectScope,
} = require("../modules/observations/access");
const {
  buildMetricRecommendations,
  serializeRecommendation,
} = require("../modules/observations/metricRecommendations");

const MAXIMUM_CHARTS = 200;
const MAXIMUM_CANDIDATES = 100;
const LIST_LIMIT = 5;
const DISMISSAL_TYPES = new Set(["later", "definition"]);

class MetricRecommendationController {
  async generate(access, { includeDismissed = false, limit = LIST_LIMIT } = {}) {
    const charts = await db.Chart.findAll({
      attributes: [
        "autoUpdate", "chartData", "chartDataUpdated", "currentEndDate", "endDate", "fixedStartDate",
        "id", "name", "project_id", "startDate", "timeInterval", "visualization",
      ],
      include: [{
        model: db.Project,
        attributes: ["ghost", "id", "name", "team_id", "timezone"],
        required: true,
        where: { ghost: false, team_id: access.teamId },
      }, {
        model: db.Alert,
        attributes: ["id", "active"],
        required: false,
      }, {
        model: db.ChartDatasetConfig,
        attributes: ["id", "dataset_id"],
        required: false,
        include: [{
          model: db.Dataset,
          attributes: ["id", "name"],
          required: false,
          include: [{
            model: db.DatasetIntelligence,
            attributes: ["status", "expires_at", "profile"],
            required: false,
          }],
        }],
      }],
      limit: MAXIMUM_CHARTS,
      order: [["chartDataUpdated", "DESC"], ["id", "ASC"]],
      where: {
        ...getProjectScope(access),
      },
    });
    const editableCharts = charts.filter((chart) => canEditProject(access, chart.project_id));
    if (editableCharts.length === 0) return [];

    const chartIds = editableCharts.map((chart) => chart.id);
    const projectIds = [...new Set(editableCharts.map((chart) => chart.project_id))];
    const [monitors, pins, dismissals] = await Promise.all([
      db.MetricMonitor.findAll({
        attributes: ["chart_id", "binding_key"],
        where: { chart_id: { [Op.in]: chartIds }, team_id: access.teamId },
      }),
      db.PinnedDashboard.findAll({
        attributes: ["project_id"],
        where: { project_id: { [Op.in]: projectIds }, team_id: access.teamId },
      }),
      includeDismissed ? [] : db.MetricRecommendationDismissal.findAll({
        attributes: [
          "chart_id", "binding_key", "definition_fingerprint", "dismissal_type", "expires_at",
        ],
        where: {
          team_id: access.teamId,
          [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }],
        },
      }),
    ]);
    const pinCounts = pins.reduce((counts, pin) => {
      const projectId = Number(pin.project_id);
      counts.set(projectId, (counts.get(projectId) || 0) + 1);
      return counts;
    }, new Map());
    return buildMetricRecommendations({
      charts: editableCharts,
      dismissals,
      monitors,
      pinCounts,
      teamId: access.teamId,
    }).slice(0, Math.min(Number(limit) || LIST_LIMIT, MAXIMUM_CANDIDATES));
  }

  async list(access) {
    const recommendations = await this.generate(access);
    return recommendations.map(serializeRecommendation);
  }

  async findCurrent(access, recommendationId, includeDismissed = false) {
    const recommendations = await this.generate(access, {
      includeDismissed,
      limit: MAXIMUM_CANDIDATES,
    });
    const recommendation = recommendations.find((item) => item.id === recommendationId);
    if (!recommendation) {
      throw createHttpError("This metric suggestion is no longer available", 409);
    }
    return recommendation;
  }

  async accept(access, recommendationId, data, user) {
    const recommendation = await this.findCurrent(access, recommendationId);
    const monitorController = new MonitorController();
    return monitorController.create(access, {
      chartId: recommendation.chart.id,
      comparison: data.comparison,
      desiredDirection: data.desiredDirection,
      importance: data.importance,
      layerId: recommendation.layerId,
      metricBehavior: data.metricBehavior,
      threshold: data.threshold,
      valueFormat: data.valueFormat || recommendation.valueFormat,
    }, user);
  }

  async dismiss(access, recommendationId, data = {}) {
    if (!DISMISSAL_TYPES.has(data.type)) {
      throw createHttpError("Choose how long to hide this metric suggestion", 400);
    }
    const recommendation = await this.findCurrent(access, recommendationId, true);
    const definition = recommendation._definition;
    const where = {
      binding_key: definition.bindingKey,
      chart_id: recommendation.chart.id,
      team_id: access.teamId,
    };
    let dismissal = await db.MetricRecommendationDismissal.findOne({ where });
    if (!dismissal) {
      dismissal = await db.MetricRecommendationDismissal.create({
        ...where,
        definition_fingerprint: definition.definitionFingerprint,
        dismissal_type: data.type,
        dismissed_by: access.userId,
        project_id: recommendation.project.id,
      });
    }
    await dismissal.update({
      definition_fingerprint: definition.definitionFingerprint,
      dismissal_type: data.type,
      dismissed_by: access.userId,
      expires_at: data.type === "later"
        ? new Date(Date.now() + (30 * 24 * 60 * 60 * 1000))
        : null,
      project_id: recommendation.project.id,
    });
    return { dismissed: true };
  }
}

module.exports = MetricRecommendationController;
