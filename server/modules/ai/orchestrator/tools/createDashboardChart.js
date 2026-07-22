const DatasetController = require("../../../../controllers/DatasetController");
const ChartController = require("../../../../controllers/ChartController");
const { getDatasetName } = require("../../../resolveChartDatasetOptions");
const { requireSupportedSourceForConnection } = require("../sourceSupport");
const {
  removeCompiledMetricAccumulation,
  repairSourceDatasetIntentAsync,
} = require("./sourceIntentRepair");
const {
  normalizeTeamId,
  requireConnectionForTeam,
  requireProjectForTeam,
} = require("./teamScope");
const { buildAiVisualization } = require("../../../../visualization/aiVisualization");

const datasetController = new DatasetController();
const chartController = new ChartController();
const clientUrl = process.env.NODE_ENV === "production" ? process.env.VITE_APP_CLIENT_HOST : process.env.VITE_APP_CLIENT_HOST_DEV;

function resolveXAxis({
  chartType, xAxis, yAxis, spec = {}
}) {
  if (chartType === "table") {
    return xAxis ?? spec.xAxis ?? "root[]";
  }

  if (["kpi", "avg", "gauge"].includes(chartType)) {
    return xAxis ?? spec.xAxis ?? yAxis ?? spec.yAxis;
  }

  return xAxis ?? spec.xAxis;
}

async function createDashboardChart(payload) {
  let {
    project_id, connection_id, name, legend, type, subType, displayLegend, pointRadius,
    dataLabels, includeZeros, timeInterval, stacked, horizontal, xLabelTicks,
    showGrowth, invertGrowth, mode, maxValue, minValue, ranges,
    xAxis, xAxisOperation, yAxis, yAxisOperation, dateField, dateFormat,
    query, method, route, itemsLimit, conditions = [], configuration = {}, variables = [], transform = null,
    variableBindings = [], spec = {}, team_id, formula, seriesConfiguration,
    encoding, visualization,
  } = payload;

  if (!team_id) {
    throw new Error("team_id is required to create a dashboard chart");
  }
  if (!project_id) {
    throw new Error("project_id is required to create a dashboard chart");
  }
  if (!connection_id) {
    throw new Error("connection_id is required to create a dashboard chart");
  }
  if (!name) {
    throw new Error("name is required to create a dashboard chart");
  }

  try {
    const normalizedTeamId = normalizeTeamId(team_id);
    const project = await requireProjectForTeam(project_id, normalizedTeamId);
    const connection = await requireConnectionForTeam(connection_id, normalizedTeamId);
    const source = requireSupportedSourceForConnection(connection);

    if (project.ghost) {
      throw new Error("project_id must be a visible dashboard");
    }

    const repairedPayload = await repairSourceDatasetIntentAsync(source, {
      name,
      question: payload.question,
      original_question: payload.original_question,
      query,
      method,
      route,
      itemsLimit,
      conditions,
      configuration,
      connection,
      spec,
    });
    query = repairedPayload.query ?? query;
    configuration = repairedPayload.configuration;
    method = repairedPayload.method ?? method;
    route = repairedPayload.route ?? route;
    itemsLimit = repairedPayload.itemsLimit ?? itemsLimit;
    conditions = repairedPayload.conditions ?? conditions;
    variables = repairedPayload.variables ?? variables;
    spec = repairedPayload.spec || spec;
    if (repairedPayload.intentRepair?.repaired) {
      type = spec.type ?? type;
      xAxis = spec.xAxis ?? xAxis;
      yAxis = spec.yAxis ?? yAxis;
      yAxisOperation = spec.yAxisOperation ?? yAxisOperation;
    }

    const chartSanitization = removeCompiledMetricAccumulation({
      configuration,
      type,
      subType,
      spec,
    });
    subType = chartSanitization.subType;
    spec = chartSanitization.spec;
    const chartType = type || spec.type || "line";
    const resolvedXAxis = resolveXAxis({
      chartType, xAxis, yAxis, spec
    });
    const resolvedDisplayLegend = displayLegend !== undefined
      ? displayLegend
      : spec.displayLegend ?? true;
    const resolvedIncludeZeros = includeZeros !== undefined
      ? includeZeros
      : spec.includeZeros ?? true;
    const dataset = await datasetController.createWithDataRequests({
      team_id: normalizedTeamId,
      project_ids: [Number(project_id)],
      draft: false,
      name: name || "AI Generated Dataset",
      variableBindings,
      dataRequests: [{
        connection_id,
        method,
        route,
        itemsLimit,
        query,
        conditions,
        configuration: configuration || {},
        variables: variables || [],
        useGlobalHeaders: repairedPayload.useGlobalHeaders ?? payload.useGlobalHeaders,
        headers: repairedPayload.headers ?? payload.headers,
        body: repairedPayload.body ?? payload.body,
        pagination: repairedPayload.pagination ?? payload.pagination,
        items: repairedPayload.items ?? payload.items,
        offset: repairedPayload.offset ?? payload.offset,
        paginationField: repairedPayload.paginationField ?? payload.paginationField,
        template: repairedPayload.template ?? payload.template,
        transform: transform || null
      }],
      main_dr_index: 0
    });
    const canonicalVisualization = buildAiVisualization({
      bindingId: "binding-1",
      chart: {
        ...spec,
        name,
        type: chartType,
        stacked: stacked ?? spec.stacked ?? spec.options?.stacked,
        horizontal: horizontal ?? spec.horizontal ?? spec.options?.horizontal,
      },
      cdc: {
        xAxis: resolvedXAxis,
        xAxisOperation: xAxisOperation ?? spec.xAxisOperation,
        yAxis: yAxis ?? spec.yAxis,
        yAxisOperation: yAxisOperation ?? spec.yAxisOperation ?? "none",
        dateField: dateField ?? spec.dateField,
        formula: formula ?? spec.formula,
        goal: spec.goal,
        legend: legend ?? spec.legend ?? getDatasetName(dataset),
        datasetColor: spec.datasetColor || spec.options?.color || "#4285F4",
        fillColor: spec.fillColor,
        fill: spec.fill || false,
        multiFill: spec.multiFill || false,
        pointRadius: pointRadius || spec.pointRadius || 0,
      },
      encoding: encoding || spec.encoding,
      goal: spec.goal,
      visualization: visualization || spec.visualization,
    });

    const dataRequestId = dataset.DataRequests && dataset.DataRequests.length > 0
      ? dataset.DataRequests[0].id
      : dataset.main_dr_id;

    const chart = await chartController.createWithChartDatasetConfigs({
      project_id,
      name: name || "AI Generated Chart",
      type: chartType,
      subType: subType || spec.subType,
      draft: false,
      displayLegend: resolvedDisplayLegend,
      pointRadius: pointRadius || spec.pointRadius || 0,
      dataLabels: dataLabels || spec.dataLabels || false,
      includeZeros: resolvedIncludeZeros,
      timeInterval: timeInterval || spec.timeInterval || "day",
      stacked: stacked ?? spec.stacked ?? spec.options?.stacked ?? false,
      horizontal: horizontal ?? spec.horizontal ?? spec.options?.horizontal ?? false,
      xLabelTicks: xLabelTicks || spec.xLabelTicks || "default",
      showGrowth: showGrowth || spec.showGrowth || false,
      invertGrowth: invertGrowth || spec.invertGrowth || false,
      mode: mode || spec.mode || "chart",
      maxValue: maxValue || spec.maxValue,
      minValue: minValue || spec.minValue,
      ranges: ranges || spec.ranges,
      visualization: canonicalVisualization,
      chartDatasetConfigs: [{
        templateBindingId: "binding-1",
        dataset_id: dataset.id,
        xAxis: resolvedXAxis,
        xAxisOperation: xAxisOperation ?? spec.xAxisOperation,
        yAxis: yAxis ?? spec.yAxis,
        yAxisOperation: yAxisOperation ?? spec.yAxisOperation ?? "none",
        dateField: dateField ?? spec.dateField,
        dateFormat: dateFormat ?? spec.dateFormat,
        conditions: conditions ?? spec.conditions,
        formula: formula ?? spec.formula,
        datasetColor: spec.datasetColor || spec.options?.color || "#4285F4",
        fillColor: spec.fillColor,
        fill: spec.fill || false,
        multiFill: spec.multiFill || false,
        legend: legend ?? spec.legend ?? getDatasetName(dataset),
        pointRadius: pointRadius || spec.pointRadius || 0,
        excludedFields: spec.excludedFields || [],
        sort: spec.sort,
        columnsOrder: spec.columnsOrder,
        order: 1,
        maxRecords: spec.maxRecords,
        goal: spec.goal,
        configuration: seriesConfiguration ?? spec.configuration ?? {}
      }]
    }, null);

    let snapshot = null;
    try {
      snapshot = await chartController.takeSnapshot(chart.id);
    } catch (snapshotError) {
      // Ignore snapshot errors - chart creation was successful.
    }

    return {
      status: "ok",
      chart_created: true,
      chart_id: chart.id,
      dataset_id: dataset.id,
      data_request_id: dataRequestId,
      name: chart.name,
      type: chart.type,
      project_id: project.id,
      visibility: "dashboard",
      dashboard_url: `${clientUrl}/dashboard/${project.id}`,
      chart_url: `${clientUrl}/dashboard/${project.id}/chart/${chart.id}/edit`,
      snapshot,
      snapshot_status: snapshot ? "available" : "unavailable",
      snapshot_note: snapshot
        ? null
        : "The chart was created, but a rendered snapshot is not available yet.",
      intent_repair: repairedPayload.intentRepair,
      chart_sanitization: chartSanitization.accumulationRemoved
        ? { removedAccumulation: true }
        : null,
    };
  } catch (error) {
    throw new Error(`Dashboard chart creation failed: ${error.message}`);
  }
}

module.exports = createDashboardChart;
