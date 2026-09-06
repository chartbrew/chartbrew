const db = require("../../../../models/models");
const DatasetController = require("../../../../controllers/DatasetController");
const ChartController = require("../../../../controllers/ChartController");
const { getDatasetName } = require("../../../resolveChartDatasetOptions");
const { requireSupportedSourceForConnection } = require("../sourceSupport");
const createChart = require("./createChart");
const {
  alignSourceChartBindings,
  removeCompiledMetricAccumulation,
  repairSourceDatasetIntentAsync,
} = require("./sourceIntentRepair");
const {
  normalizeTeamId,
  requireConnectionForTeam,
  requireDatasetForTeam,
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

function assertDatasetAccess(dataset, allowedProjectIds) {
  if (!Array.isArray(allowedProjectIds)) return;
  const allowed = new Set(allowedProjectIds.map(Number));
  const datasetProjectIds = Array.isArray(dataset.project_ids) ? dataset.project_ids : [];
  if (!datasetProjectIds.some((projectId) => allowed.has(Number(projectId)))) {
    throw new Error("Dataset is not available in your projects");
  }
}

async function getDatasetDataRequestId(dataset) {
  if (Array.isArray(dataset.DataRequests) && dataset.DataRequests.length > 0) {
    return dataset.DataRequests[0].id;
  }
  if (dataset.main_dr_id) return dataset.main_dr_id;
  const dataRequest = await db.DataRequest.findOne({
    attributes: ["id"],
    where: { dataset_id: dataset.id },
  });
  return dataRequest?.id || null;
}

async function createTemporaryChartFromDataset(payload, normalizedTeamId) {
  const dataset = await requireDatasetForTeam(payload.dataset_id, normalizedTeamId);
  assertDatasetAccess(dataset, payload.allowed_project_ids);
  const ghostProject = await db.Project.findOne({
    where: {
      ghost: true,
      team_id: normalizedTeamId,
    },
  });
  if (!ghostProject) {
    throw new Error("Temporary preview project not found for this team");
  }
  const result = await createChart({
    ...payload,
    project_id: ghostProject.id,
    team_id: normalizedTeamId,
  });
  const chartResult = { ...result };
  delete chartResult.dashboard_url;
  return {
    ...chartResult,
    data_request_id: await getDatasetDataRequestId(dataset),
    datasets: [{
      id: dataset.id,
      name: dataset.name || dataset.legend || "Dataset",
      projectId: (dataset.project_ids || [])[0] || null,
    }],
    dashboard: null,
    ghost_project_id: ghostProject.id,
    is_temporary: true,
    project_id: ghostProject.id,
    visibility: "temporary",
  };
}

async function createTemporaryChart(payload) {
  let {
    connection_id, dataset_id, name, legend, type, subType, displayLegend, pointRadius,
    dataLabels, includeZeros, timeInterval, stacked, horizontal, xLabelTicks,
    showGrowth, invertGrowth, mode, maxValue, minValue, ranges,
    xAxis, xAxisOperation, yAxis, yAxisOperation, dateField, dateFormat,
    query, method, route, itemsLimit, conditions = [], configuration = {}, variables = [], transform = null,
    variableBindings = [], spec = {}, team_id, formula, seriesConfiguration,
    encoding, visualization,
  } = payload;

  if (!team_id) {
    throw new Error("team_id is required to create a temporary chart");
  }

  if (!name) {
    throw new Error("name is required to create a temporary chart");
  }

  try {
    const normalizedTeamId = normalizeTeamId(team_id);
    if (dataset_id) {
      return await createTemporaryChartFromDataset({
        ...payload,
        dataset_id,
        name,
      }, normalizedTeamId);
    }
    if (!connection_id) {
      throw new Error("connection_id or dataset_id is required to create a temporary chart");
    }
    const connection = await requireConnectionForTeam(connection_id, normalizedTeamId);
    const source = requireSupportedSourceForConnection(connection);

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
    const alignedBindings = await alignSourceChartBindings(source, {
      connection,
      configuration,
      type: chartType,
      xAxis: resolveXAxis({
        chartType, xAxis, yAxis, spec
      }),
      yAxis: yAxis ?? spec.yAxis,
      dateField: dateField ?? spec.dateField,
    });
    const resolvedXAxis = alignedBindings.xAxis;
    yAxis = alignedBindings.yAxis ?? yAxis;
    dateField = alignedBindings.dateField ?? dateField;

    // Find the temporary preview project for this team
    const ghostProject = await db.Project.findOne({
      where: {
        team_id: normalizedTeamId,
        ghost: true
      }
    });

    if (!ghostProject) {
      throw new Error("Temporary preview project not found for this team");
    }

    // Create the dataset first
    // Note: project_ids is empty for temporary charts - ghost projects should not be included
    const dataset = await datasetController.createWithDataRequests({
      team_id: normalizedTeamId,
      project_ids: [],
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

    // Extract data request ID from the returned dataset
    const dataRequestId = dataset.DataRequests && dataset.DataRequests.length > 0
      ? dataset.DataRequests[0].id
      : dataset.main_dr_id;
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

    // Create the chart in the temporary preview project
    const chart = await chartController.createWithChartDatasetConfigs({
      project_id: ghostProject.id,
      name: name || "AI Generated Chart",
      type: chartType,
      subType: subType || spec.subType,
      draft: false,
      // oxlint-disable-next-line no-nested-ternary
      displayLegend: displayLegend !== undefined
        ? displayLegend
        : spec.displayLegend !== undefined
          ? spec.displayLegend
          : true,
      pointRadius: pointRadius || spec.pointRadius || 0,
      dataLabels: dataLabels || spec.dataLabels || false,
      // oxlint-disable-next-line no-nested-ternary
      includeZeros: includeZeros !== undefined
        ? includeZeros
        : spec.includeZeros !== undefined
          ? spec.includeZeros
          : true,
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

    // Take a snapshot of the temporary chart for visualization
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
      dataset_id: dataset.id,
      data_request_id: dataRequestId,
      datasets: [{
        id: dataset.id,
        name: dataset.name || dataset.legend || "Dataset",
        projectId: null,
      }],
      dashboard: null,
      name: chart.name,
      type: chart.type,
      project_id: ghostProject.id,
      is_temporary: true,
      visibility: "temporary",
      chart_url: `${clientUrl}/dashboard/${ghostProject.id}/chart/${chart.id}/edit`,
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
    throw new Error(`Temporary chart creation failed: ${error.message}`);
  }
}

module.exports = createTemporaryChart;
module.exports.assertDatasetAccess = assertDatasetAccess;
module.exports.createTemporaryChartFromDataset = createTemporaryChartFromDataset;
module.exports.getDatasetDataRequestId = getDatasetDataRequestId;
