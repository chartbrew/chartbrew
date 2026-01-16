const db = require("../../../../models/models");
const DatasetController = require("../../../../controllers/DatasetController");
const ChartController = require("../../../../controllers/ChartController");

const datasetController = new DatasetController();
const chartController = new ChartController();

async function createTemporaryChart(payload) {
  const {
    connection_id, name, legend, type, subType, displayLegend, pointRadius,
    dataLabels, includeZeros, timeInterval, stacked, horizontal,
    showGrowth, invertGrowth, mode, maxValue, minValue, ranges,
    xAxis, yAxis, yAxisOperation = "none", dateField, dateFormat,
    query, conditions = [], configuration = {}, variables = [], transform = null,
    variableBindings = [], spec = {}, team_id
  } = payload;

  if (!team_id) {
    throw new Error("team_id is required to create a temporary chart");
  }

  if (!connection_id) {
    throw new Error("connection_id is required to create a temporary chart");
  }

  if (!name) {
    throw new Error("name is required to create a temporary chart");
  }

  try {
    // Find the temporary preview project for this team
    const ghostProject = await db.Project.findOne({
      where: {
        team_id,
        ghost: true
      }
    });

    if (!ghostProject) {
      throw new Error("Temporary preview project not found for this team");
    }

    // Create the dataset first
    // Note: project_ids is empty for temporary charts - ghost projects should not be included
    const dataset = await datasetController.createWithDataRequests({
      team_id,
      project_ids: [],
      draft: false,
      legend: name || "AI Generated Dataset",
      xAxis,
      yAxis,
      yAxisOperation,
      dateField,
      dateFormat,
      conditions,
      variableBindings,
      dataRequests: [{
        connection_id,
        query,
        conditions: conditions || [],
        configuration: configuration || {},
        variables: variables || [],
        transform: transform || null
      }],
      main_dr_index: 0
    });

    // Extract data request ID from the returned dataset
    const dataRequestId = dataset.DataRequests && dataset.DataRequests.length > 0
      ? dataset.DataRequests[0].id
      : dataset.main_dr_id;

    // Create the chart in the temporary preview project
    const chart = await chartController.createWithChartDatasetConfigs({
      project_id: ghostProject.id,
      name: name || "AI Generated Chart",
      type: type || spec.type || "line",
      subType: subType || spec.subType,
      draft: false,
      // eslint-disable-next-line no-nested-ternary
      displayLegend: displayLegend !== undefined
        ? displayLegend
        : spec.displayLegend !== undefined
          ? spec.displayLegend
          : true,
      pointRadius: pointRadius || spec.pointRadius || 0,
      dataLabels: dataLabels || spec.dataLabels || false,
      // eslint-disable-next-line no-nested-ternary
      includeZeros: includeZeros !== undefined
        ? includeZeros
        : spec.includeZeros !== undefined
          ? spec.includeZeros
          : true,
      timeInterval: timeInterval || spec.timeInterval || "day",
      stacked: stacked ?? spec.stacked ?? spec.options?.stacked ?? false,
      horizontal: horizontal ?? spec.horizontal ?? spec.options?.horizontal ?? false,
      showGrowth: showGrowth || spec.showGrowth || false,
      invertGrowth: invertGrowth || spec.invertGrowth || false,
      mode: mode || spec.mode || "chart",
      maxValue: maxValue || spec.maxValue,
      minValue: minValue || spec.minValue,
      ranges: ranges || spec.ranges,
      chartDatasetConfigs: [{
        dataset_id: dataset.id,
        formula: spec.formula,
        datasetColor: spec.datasetColor || spec.options?.color || "#4285F4",
        fillColor: spec.fillColor,
        fill: spec.fill || false,
        multiFill: spec.multiFill || false,
        legend: legend || spec.title || dataset.legend,
        pointRadius: pointRadius || spec.pointRadius || 0,
        excludedFields: spec.excludedFields || [],
        sort: spec.sort,
        columnsOrder: spec.columnsOrder,
        order: 1,
        maxRecords: spec.maxRecords,
        goal: spec.goal,
        configuration: spec.configuration || {}
      }]
    }, null);

    // Take a snapshot of the temporary chart for visualization
    let snapshot = null;
    try {
      snapshot = await chartController.takeSnapshot(chart.id);
    } catch (snapshotError) {
      // Ignore snapshot errors - chart creation was successful
    }

    return {
      chart_id: chart.id,
      dataset_id: dataset.id,
      data_request_id: dataRequestId,
      name: chart.name,
      type: chart.type,
      project_id: ghostProject.id,
      is_temporary: true,
      snapshot,
    };
  } catch (error) {
    throw new Error(`Temporary chart creation failed: ${error.message}`);
  }
}

module.exports = createTemporaryChart;
