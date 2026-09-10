const db = require("../../../../models/models");
const ChartController = require("../../../../controllers/ChartController");
const { calculateChartLayout, ensureCompleteLayout } = require("../../../chartLayoutEngine");
const { normalizeTeamId } = require("./teamScope");

async function moveChartToDashboard(payload) {
  const {
    chart_id, target_project_id, team_id
  } = payload;

  if (!chart_id) {
    throw new Error("chart_id is required to move a chart");
  }

  if (!target_project_id) {
    throw new Error("target_project_id is required to move a chart");
  }

  if (!team_id) {
    throw new Error("team_id is required to move a chart");
  }

  try {
    const normalizedTeamId = normalizeTeamId(team_id);
    const result = await db.sequelize.transaction(async (transaction) => {
      // Find the chart
      const chart = await db.Chart.findByPk(chart_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!chart) {
        throw new Error("Chart not found");
      }

      // Verify the chart belongs to the team
      const currentProject = await db.Project.findByPk(chart.project_id, { transaction });
      if (!currentProject || currentProject.team_id !== normalizedTeamId) {
        throw new Error("Chart does not belong to the specified team");
      }

      // Verify the target project exists and belongs to the team
      const targetProject = await db.Project.findByPk(target_project_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!targetProject || targetProject.team_id !== normalizedTeamId) {
        throw new Error("Target project not found or does not belong to the specified team");
      }

      if (targetProject.ghost) {
        throw new Error("Cannot move chart to this project");
      }

      const isAlreadyPlaced = Number(chart.project_id) === Number(target_project_id);
      if (!currentProject.ghost && !isAlreadyPlaced) {
        throw Object.assign(new Error("This chart is already saved to a dashboard"), { statusCode: 409 });
      }
      if (!isAlreadyPlaced) {
        const existingCharts = await db.Chart.findAll({
          where: { project_id: target_project_id },
          attributes: ["layout"],
          transaction,
        });
        const finalLayout = ensureCompleteLayout(calculateChartLayout(existingCharts));
        await db.Chart.update(
          {
            project_id: target_project_id,
            layout: finalLayout
          },
          { where: { id: chart_id }, transaction }
        );
      }

      // Update project_ids for all datasets used by this chart
      const chartDatasetConfigs = await db.ChartDatasetConfig.findAll({
        where: { chart_id },
        attributes: ["dataset_id"],
        transaction,
      });
      const datasets = await db.Dataset.findAll({
        where: { id: chartDatasetConfigs.map((config) => config.dataset_id) },
        order: [["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE,
      });
      await Promise.all(datasets.map(async (dataset) => {
        const currentProjectIds = dataset.project_ids || [];
        if (!currentProjectIds.some((id) => Number(id) === Number(targetProject.id))) {
          await dataset.update({ project_ids: [...currentProjectIds, targetProject.id] }, { transaction });
        }
      }));

      return {
        chart_id,
        chart_name: chart.name,
        chart_type: chart.type,
        previous_project_id: chart.project_id,
        new_project_id: target_project_id,
        project_id: target_project_id,
        visibility: "dashboard",
        dashboard: {
          id: targetProject.id,
          name: targetProject.name,
        },
        datasets: datasets.map((dataset) => ({
          id: dataset.id,
          name: dataset.name || dataset.legend || "Dataset",
          projectId: targetProject.id,
        })),
        dashboard_url: `${global.clientUrl}/dashboard/${target_project_id}`,
        chart_url: `${global.clientUrl}/dashboard/${target_project_id}/chart/${chart_id}/edit`,
      };
    });
    // Refresh only after both the chart and dataset updates have committed.
    if (Number(result.previous_project_id) !== Number(result.project_id)) {
      new ChartController().updateChartData(chart_id, null, {}).catch(() => null);
    }
    return result;
  } catch (error) {
    throw Object.assign(new Error(`Chart move failed: ${error.message}`, { cause: error }), { statusCode: error.statusCode });
  }
}

module.exports = moveChartToDashboard;
