const db = require("../../../../models/models");
const ChartController = require("../../../../controllers/ChartController");

const chartController = new ChartController();

const clientUrl = process.env.NODE_ENV === "production" ? process.env.VITE_APP_CLIENT_HOST : process.env.VITE_APP_CLIENT_HOST_DEV;

async function createChart(payload) {
  const {
    project_id, dataset_id, spec,
    name, legend, type, subType, displayLegend, pointRadius,
    dataLabels, includeZeros, timeInterval, stacked, horizontal,
    showGrowth, invertGrowth, mode, maxValue, minValue, ranges
  } = payload;

  if (!project_id) {
    throw new Error("project_id is required to create a chart");
  }

  if (!name) {
    throw new Error("name is required to create a chart");
  }

  // Provide default chart spec if not provided
  const defaultSpec = {
    type: "line",
    title: "AI Generated Chart",
    timeInterval: "day",
    chartSize: 2,
    displayLegend: true,
    pointRadius: 0,
    dataLabels: false,
    includeZeros: true,
    stacked: false,
    horizontal: false,
    showGrowth: false,
    invertGrowth: false,
    mode: "chart",
    options: {}
  };

  const chartSpec = spec || defaultSpec;

  try {
    // Get the dataset to get its legend for default values
    const dataset = await db.Dataset.findByPk(dataset_id);
    if (!dataset) {
      throw new Error("Dataset not found");
    }

    // Use the quick-create function to create chart with chart dataset config in one go
    // Layout will be auto-calculated by the controller
    const chart = await chartController.createWithChartDatasetConfigs({
      project_id,
      name: name || chartSpec.title || "AI Generated Chart",
      type: type || chartSpec.type,
      subType: subType || chartSpec.subType,
      draft: false,
      // eslint-disable-next-line no-nested-ternary
      displayLegend: displayLegend !== undefined
        ? displayLegend
        : chartSpec.displayLegend !== undefined
          ? chartSpec.displayLegend
          : true,
      pointRadius: pointRadius || chartSpec.pointRadius || 0,
      dataLabels: dataLabels || chartSpec.dataLabels || false,
      // eslint-disable-next-line no-nested-ternary
      includeZeros: includeZeros !== undefined
        ? includeZeros
        : chartSpec.includeZeros !== undefined
          ? chartSpec.includeZeros
          : true,
      timeInterval: timeInterval || chartSpec.timeInterval || "day",
      stacked: stacked ?? chartSpec.stacked ?? chartSpec.options?.stacked ?? false,
      horizontal: horizontal ?? chartSpec.horizontal ?? chartSpec.options?.horizontal ?? false,
      showGrowth: showGrowth || chartSpec.showGrowth || false,
      invertGrowth: invertGrowth || chartSpec.invertGrowth || false,
      mode: mode || chartSpec.mode || "chart",
      maxValue: maxValue || chartSpec.maxValue,
      minValue: minValue || chartSpec.minValue,
      ranges: ranges || chartSpec.ranges,
      layout: chartSpec.layout, // Will be auto-calculated if not provided
      chartDatasetConfigs: [{
        dataset_id,
        formula: chartSpec.formula,
        datasetColor: chartSpec.datasetColor || chartSpec.options?.color || "#4285F4",
        fillColor: chartSpec.fillColor,
        fill: chartSpec.fill || false,
        multiFill: chartSpec.multiFill || false,
        legend: legend || chartSpec.title || dataset.legend,
        pointRadius: pointRadius || chartSpec.pointRadius || 0,
        excludedFields: chartSpec.excludedFields || [],
        sort: chartSpec.sort,
        columnsOrder: chartSpec.columnsOrder,
        order: 1,
        maxRecords: chartSpec.maxRecords,
        goal: chartSpec.goal,
        configuration: chartSpec.configuration || {}
      }]
    }, null); // No user for AI-created charts

    // Take a snapshot of the chart for visualization
    let snapshot = null;
    try {
      snapshot = await chartController.takeSnapshot(chart.id);
    } catch (snapshotError) {
      // Ignore snapshot errors - chart creation was successful
    }

    return {
      chart_id: chart.id,
      name: chart.name,
      type: chart.type,
      project_id: chart.project_id,
      dashboard_url: `${clientUrl}/dashboard/${project_id}`,
      chart_url: `${clientUrl}/dashboard/${project_id}/chart/${chart.id}/edit`,
      snapshot,
    };
  } catch (error) {
    throw new Error(`Chart creation failed: ${error.message}`);
  }
}

module.exports = createChart;
