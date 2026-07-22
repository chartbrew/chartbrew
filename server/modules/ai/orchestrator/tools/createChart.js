const db = require("../../../../models/models");
const ChartController = require("../../../../controllers/ChartController");
const { getDatasetName } = require("../../../resolveChartDatasetOptions");
const { removeCompiledMetricAccumulation } = require("./sourceIntentRepair");
const { normalizeTeamId, requireDatasetForTeam, requireProjectForTeam } = require("./teamScope");
const { buildAiVisualization } = require("../../../../visualization/aiVisualization");

const chartController = new ChartController();

const clientUrl = process.env.NODE_ENV === "production" ? process.env.VITE_APP_CLIENT_HOST : process.env.VITE_APP_CLIENT_HOST_DEV;

function resolveXAxis({
  chartType, xAxis, yAxis, chartSpec = {}
}) {
  if (chartType === "table") {
    return xAxis ?? chartSpec.xAxis ?? "root[]";
  }

  if (["kpi", "avg", "gauge"].includes(chartType)) {
    return xAxis ?? chartSpec.xAxis ?? yAxis ?? chartSpec.yAxis;
  }

  return xAxis ?? chartSpec.xAxis;
}

async function createChart(payload) {
  let {
    project_id, dataset_id, spec, team_id,
    name, legend, type, subType, displayLegend, pointRadius,
    dataLabels, includeZeros, timeInterval, stacked, horizontal,
    xLabelTicks, showGrowth, invertGrowth, mode, maxValue, minValue, ranges,
    xAxis, xAxisOperation, yAxis, yAxisOperation, dateField, dateFormat,
    conditions, formula, seriesConfiguration, encoding, visualization,
  } = payload;

  if (!project_id) {
    throw new Error("project_id is required to create a chart");
  }

  if (!name) {
    throw new Error("name is required to create a chart");
  }

  if (!team_id) {
    throw new Error("team_id is required to create a chart");
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
    xLabelTicks: "default",
    showGrowth: false,
    invertGrowth: false,
    mode: "chart",
    options: {}
  };

  let chartSpec = spec || defaultSpec;

  try {
    // Get the dataset to get its legend for default values
    const normalizedTeamId = normalizeTeamId(team_id);
    const dataset = await requireDatasetForTeam(dataset_id, normalizedTeamId);
    let dataRequest = null;
    if (Array.isArray(dataset.DataRequests) && dataset.DataRequests.length > 0) {
      dataRequest = dataset.DataRequests[0];
    } else if (dataset.main_dr_id) {
      dataRequest = await db.DataRequest.findByPk(dataset.main_dr_id);
    } else {
      dataRequest = await db.DataRequest.findOne({ where: { dataset_id } });
    }
    const chartSanitization = removeCompiledMetricAccumulation({
      configuration: dataRequest?.configuration,
      type,
      subType,
      spec: chartSpec,
    });
    subType = chartSanitization.subType;
    chartSpec = chartSanitization.spec;
    const chartType = type || chartSpec.type || "line";
    const resolvedXAxis = resolveXAxis({
      chartType, xAxis, yAxis, chartSpec
    });
    const canonicalVisualization = buildAiVisualization({
      bindingId: "binding-1",
      chart: {
        ...chartSpec,
        name,
        type: chartType,
        stacked: stacked ?? chartSpec.stacked ?? chartSpec.options?.stacked,
        horizontal: horizontal ?? chartSpec.horizontal ?? chartSpec.options?.horizontal,
      },
      cdc: {
        xAxis: resolvedXAxis,
        xAxisOperation: xAxisOperation ?? chartSpec.xAxisOperation,
        yAxis: yAxis ?? chartSpec.yAxis,
        yAxisOperation: yAxisOperation ?? chartSpec.yAxisOperation ?? "none",
        dateField: dateField ?? chartSpec.dateField,
        formula: formula ?? chartSpec.formula,
        goal: chartSpec.goal,
        legend: legend ?? chartSpec.legend ?? getDatasetName(dataset),
        datasetColor: chartSpec.datasetColor || chartSpec.options?.color || "#4285F4",
        fillColor: chartSpec.fillColor,
        fill: chartSpec.fill || false,
        multiFill: chartSpec.multiFill || false,
        pointRadius: pointRadius || chartSpec.pointRadius || 0,
      },
      encoding: encoding || chartSpec.encoding,
      goal: chartSpec.goal,
      visualization: visualization || chartSpec.visualization,
    });

    // Check if project is a ghost project
    const project = await requireProjectForTeam(project_id, normalizedTeamId);

    // Update dataset's project_ids to include this project (if not ghost and not already included)
    if (!project.ghost) {
      const currentProjectIds = dataset.project_ids || [];
      if (!currentProjectIds.includes(project_id)) {
        await dataset.update({
          project_ids: [...currentProjectIds, project_id]
        });
      }
    }

    // Use the quick-create function to create chart with chart dataset config in one go
    // Layout will be auto-calculated by the controller
    const chart = await chartController.createWithChartDatasetConfigs({
      project_id,
      name: name || chartSpec.title || "AI Generated Chart",
      type: chartType,
      subType: subType || chartSpec.subType,
      draft: false,
      // oxlint-disable-next-line no-nested-ternary
      displayLegend: displayLegend !== undefined
        ? displayLegend
        : chartSpec.displayLegend !== undefined
          ? chartSpec.displayLegend
          : true,
      pointRadius: pointRadius || chartSpec.pointRadius || 0,
      dataLabels: dataLabels || chartSpec.dataLabels || false,
      // oxlint-disable-next-line no-nested-ternary
      includeZeros: includeZeros !== undefined
        ? includeZeros
        : chartSpec.includeZeros !== undefined
          ? chartSpec.includeZeros
          : true,
      timeInterval: timeInterval || chartSpec.timeInterval || "day",
      stacked: stacked ?? chartSpec.stacked ?? chartSpec.options?.stacked ?? false,
      horizontal: horizontal ?? chartSpec.horizontal ?? chartSpec.options?.horizontal ?? false,
      xLabelTicks: xLabelTicks || chartSpec.xLabelTicks || "default",
      showGrowth: showGrowth || chartSpec.showGrowth || false,
      invertGrowth: invertGrowth || chartSpec.invertGrowth || false,
      mode: mode || chartSpec.mode || "chart",
      maxValue: maxValue || chartSpec.maxValue,
      minValue: minValue || chartSpec.minValue,
      ranges: ranges || chartSpec.ranges,
      visualization: canonicalVisualization,
      layout: chartSpec.layout, // Will be auto-calculated if not provided
      chartDatasetConfigs: [{
        templateBindingId: "binding-1",
        dataset_id,
        xAxis: resolvedXAxis,
        xAxisOperation: xAxisOperation ?? chartSpec.xAxisOperation,
        yAxis: yAxis ?? chartSpec.yAxis,
        yAxisOperation: yAxisOperation ?? chartSpec.yAxisOperation ?? "none",
        dateField: dateField ?? chartSpec.dateField,
        dateFormat: dateFormat ?? chartSpec.dateFormat,
        conditions: conditions ?? chartSpec.conditions,
        formula: formula ?? chartSpec.formula,
        datasetColor: chartSpec.datasetColor || chartSpec.options?.color || "#4285F4",
        fillColor: chartSpec.fillColor,
        fill: chartSpec.fill || false,
        multiFill: chartSpec.multiFill || false,
        legend: legend ?? chartSpec.legend ?? getDatasetName(dataset),
        pointRadius: pointRadius || chartSpec.pointRadius || 0,
        excludedFields: chartSpec.excludedFields || [],
        sort: chartSpec.sort,
        columnsOrder: chartSpec.columnsOrder,
        order: 1,
        maxRecords: chartSpec.maxRecords,
        goal: chartSpec.goal,
        configuration: seriesConfiguration ?? chartSpec.configuration ?? {}
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
      status: "ok",
      chart_created: true,
      chart_id: chart.id,
      dataset_id,
      name: chart.name,
      type: chart.type,
      project_id: chart.project_id,
      visibility: "dashboard",
      dashboard_url: `${clientUrl}/dashboard/${project_id}`,
      chart_url: `${clientUrl}/dashboard/${project_id}/chart/${chart.id}/edit`,
      snapshot,
      snapshot_status: snapshot ? "available" : "unavailable",
      snapshot_note: snapshot
        ? null
        : "The chart was created, but a rendered snapshot is not available yet.",
      chart_sanitization: chartSanitization.accumulationRemoved
        ? { removedAccumulation: true }
        : null,
    };
  } catch (error) {
    throw new Error(`Chart creation failed: ${error.message}`);
  }
}

module.exports = createChart;
