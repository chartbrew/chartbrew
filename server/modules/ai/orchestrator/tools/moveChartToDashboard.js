const db = require("../../../../models/models");
const { calculateChartLayout, ensureCompleteLayout } = require("../../../chartLayoutEngine");

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
    // Find the chart
    const chart = await db.Chart.findByPk(chart_id);
    if (!chart) {
      throw new Error("Chart not found");
    }

    // Verify the chart belongs to the team
    const currentProject = await db.Project.findByPk(chart.project_id);
    if (!currentProject || currentProject.team_id !== team_id) {
      throw new Error("Chart does not belong to the specified team");
    }

    // Verify the target project exists and belongs to the team
    const targetProject = await db.Project.findByPk(target_project_id);
    if (!targetProject || targetProject.team_id !== team_id) {
      throw new Error("Target project not found or does not belong to the specified team");
    }

    if (targetProject.ghost) {
      throw new Error("Cannot move chart to this project");
    }

    // Get existing charts in the target project for layout calculation
    const existingCharts = await db.Chart.findAll({
      where: { project_id: target_project_id },
      attributes: ["layout"],
    });

    // Calculate new layout for the chart
    const calculatedLayout = calculateChartLayout(existingCharts);
    const finalLayout = ensureCompleteLayout(calculatedLayout);

    // Update the chart's project_id and layout
    await db.Chart.update(
      {
        project_id: target_project_id,
        layout: finalLayout
      },
      { where: { id: chart_id } }
    );

    // Update project_ids for all datasets used by this chart
    const chartDatasetConfigs = await db.ChartDatasetConfig.findAll({
      where: { chart_id },
      include: [{
        model: db.Dataset,
        as: "Dataset"
      }]
    });

    for (const cdc of chartDatasetConfigs) {
      if (cdc.Dataset) {
        const currentProjectIds = cdc.Dataset.project_ids || [];

        // Add target project if not already included
        if (!currentProjectIds.includes(target_project_id)) {
          cdc.Dataset.update({
            project_ids: [...currentProjectIds, target_project_id]
          });
        }
      }
    }

    // Run the chart update in the background
    try {
      const ChartController = require("../../../controllers/ChartController"); // eslint-disable-line
      const chartController = new ChartController();
      chartController.updateChartData(chart_id, null, {});
    } catch {
      // Ignore background update errors
    }

    return {
      chart_id,
      previous_project_id: chart.project_id,
      new_project_id: target_project_id,
      dashboard_url: `${global.clientUrl}/dashboard/${target_project_id}`,
      chart_url: `${global.clientUrl}/dashboard/${target_project_id}/chart/${chart_id}/edit`,
    };
  } catch (error) {
    throw new Error(`Chart move failed: ${error.message}`);
  }
}

module.exports = moveChartToDashboard;
