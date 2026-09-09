const db = require("../models/models");
const ChartController = require("./ChartController");
const { getObservationAccess, assertCanViewProject, canEditProject, createHttpError } = require("../modules/observations/access");
const moveChartToDashboard = require("../modules/ai/orchestrator/tools/moveChartToDashboard");

async function loadPreview(chartId, userId) {
  if (!/^[1-9]\d*$/.test(String(chartId))) throw createHttpError("Preview not found", 404);
  const chart = await db.Chart.findByPk(chartId, {
    include: [{ model: db.Project, required: true }, { model: db.ChartDatasetConfig, include: [db.Dataset] }],
  });
  if (!chart) throw createHttpError("Preview not found", 404);
  const access = await getObservationAccess(chart.Project.team_id, userId);
  if (!chart.Project.ghost) assertCanViewProject(access, chart.project_id);
  if (!access.allProjects && (chart.draft || chart.ChartDatasetConfigs.some(({ Dataset: dataset }) => (
    !dataset || Number(dataset.team_id) !== access.teamId
      || !(dataset.project_ids || []).some((id) => access.projectIds.includes(Number(id)))
  )))) throw createHttpError("Access denied", 403);
  return { chart, access };
}

async function getPreview(chartId, userId) {
  const { chart, access } = await loadPreview(chartId, userId);
  const rendered = await new ChartController().findById(chart.id);
  if (!rendered) throw createHttpError("Preview not found", 404);
  return {
    chart: rendered,
    teamId: access.teamId,
    parsed: {
      type: chart.Project.ghost ? "chart_temporary" : "chart_created",
      visibility: chart.Project.ghost ? "temporary" : "dashboard",
      chartId: chart.id, chartName: chart.name, chartType: chart.type, projectId: chart.project_id,
      dashboard: chart.Project.ghost ? null : { id: chart.project_id, name: chart.Project.name },
    },
  };
}

async function placePreview(chartId, targetProjectId, userId) {
  if (!/^[1-9]\d*$/.test(String(targetProjectId))) throw createHttpError("Choose a dashboard", 400);
  const { chart, access } = await loadPreview(chartId, userId);
  const target = await db.Project.findOne({ where: { id: targetProjectId, team_id: access.teamId, ghost: false } });
  if (!target) throw createHttpError("Dashboard not found", 404);
  if (!canEditProject(access, target.id)) throw createHttpError("You cannot add charts to this dashboard", 403);
  if (!chart.Project.ghost && Number(chart.project_id) !== Number(target.id)) {
    throw createHttpError("This chart is already saved to a dashboard", 409);
  }
  await moveChartToDashboard({ chart_id: chart.id, target_project_id: target.id, team_id: access.teamId });
  return getPreview(chart.id, userId);
}

module.exports = { getPreview, placePreview };
