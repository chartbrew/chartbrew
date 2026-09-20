const db = require("../models/models");
const ChartController = require("../controllers/ChartController");
const DatasetController = require("../controllers/DatasetController");
const { getObservationAccess, canEditProject, createHttpError } = require("./observations/access");
const { getWorkspaceOrchestratorPolicy } = require("./workspaceContext/policy");
const { getChartCreationProvider, callTool } = require("./ai/orchestrator/orchestrator");
const { planInlineChart } = require("./ai/orchestrator/inlineChart");
const createChart = require("./ai/orchestrator/tools/createChart");
const { prepareDashboardChart } = require("./ai/orchestrator/tools/createDashboardChart");
const listConnections = require("./ai/orchestrator/tools/listConnections");
const runQuery = require("./ai/orchestrator/tools/runQuery");
const { findSourceForConnection } = require("../sources");
const { sourceUsesSourceOwnedConfiguration } = require("./ai/orchestrator/sourceSupport");
const { getSafeViewerFields, findRows } = require("./ai/orchestrator/tools/runExistingDataset");
const { applyTransformation } = require("./dataTransformations");
const { discoverDatasetFieldsSchema } = require("./datasetSchema");
const { datasetDefaults, fingerprint, applyChartLimit, TYPES, OPERATIONS } = require("./chartCreationDefaults");
const { VisualizationEngine } = require("../visualization/VisualizationEngine");
const { resolveChartDatasetOptions } = require("./resolveChartDatasetOptions");
const { remapVisualizationBindings } = require("../visualization/remapBindings");
const { applyChartCompatibilityUpdate } = require("../visualization/compatibilityUpdates");
const { getMap } = require("../visualization/geo");
const { getFieldValue } = require("../visualization/fieldPath");

const chartController = new ChartController();
const datasetController = new DatasetController();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message, status = 400) => createHttpError(message, status);

function getInlineBindings(chart) {
  const encoding = chart?.visualization?.layers?.[0]?.encoding || {};
  return Object.fromEntries(Object.entries({
    xAxis: (encoding.location || encoding.time || encoding.category)?.field,
    yAxis: encoding.value?.field,
    yAxisOperation: encoding.value?.aggregate,
  }).filter(([, value]) => value != null));
}

async function getAccess(projectId, userId) {
  if (!Number.isSafeInteger(Number(projectId)) || Number(projectId) < 1) throw fail("Dashboard not found.", 404);
  const project = await db.Project.findOne({ where: { id: projectId, ghost: false } });
  if (!project) throw fail("Dashboard not found.", 404);
  const access = await getObservationAccess(project.team_id, userId);
  if (!canEditProject(access, project.id)) throw fail("You cannot add charts to this dashboard.", 403);
  return { access, project };
}

async function getDataset(access, id, fixed = {}, transaction) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) throw fail("Choose an available dataset.");
  if (fixed.datasetId && Number(id) !== Number(fixed.datasetId)) throw fail("Choose another dataset before changing the data.", 403);
  const dataset = await db.Dataset.findOne({
    where: { id, team_id: access.teamId, draft: false }, transaction,
    include: [{ model: db.DataRequest }],
  });
  if (!dataset || (!access.allProjects && !(dataset.project_ids || []).some((value) => access.projectIds.includes(Number(value))))) {
    throw fail("This dataset is not available. Choose another dataset.", 403);
  }
  if (fixed.connectionId && (!dataset.DataRequests.length || !dataset.DataRequests.every((request) => Number(request.connection_id) === Number(fixed.connectionId)))) {
    throw fail("This dataset does not use the selected source.", 403);
  }
  return dataset;
}

async function getConnection(access, id, fixed = {}, transaction) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) throw fail("Choose an available source.");
  if (!access.canConfigureTeam || (fixed.connectionId && Number(id) !== Number(fixed.connectionId)) || fixed.datasetId) {
    throw fail("Use an available dataset or ask an administrator to prepare the data.", 403);
  }
  const connection = await db.Connection.findOne({ where: { id, team_id: access.teamId, active: true }, transaction });
  if (!connection) throw fail("This source is unavailable. Choose another source.", 403);
  return connection;
}

function chartVersion(chart) {
  const plain = chart.toJSON ? chart.toJSON() : chart;
  return fingerprint({ name: plain.name, visualization: plain.visualization, type: plain.type, timeInterval: plain.timeInterval,
    startDate: plain.startDate, endDate: plain.endDate, currentEndDate: plain.currentEndDate,
    fixedStartDate: plain.fixedStartDate,
    settings: Object.fromEntries(["subType", "displayLegend", "pointRadius", "dataLabels", "includeZeros", "stacked", "horizontal", "xLabelTicks", "showGrowth", "invertGrowth", "mode", "maxValue", "minValue", "ranges"].map((key) => [key, plain[key]])),
    configs: plain.ChartDatasetConfigs?.map((config) => {
      const copy = { ...config };
      ["id", "createdAt", "updatedAt"].forEach((key) => delete copy[key]);
      return copy;
    }) });
}

async function loadChart(projectId, chartId, transaction) {
  const chart = await db.Chart.findOne({ where: { id: chartId, project_id: projectId }, transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
  if (!chart) throw fail("This chart is no longer available.", 404);
  chart.setDataValue("ChartDatasetConfigs", await db.ChartDatasetConfig.findAll({ where: { chart_id: chart.id }, transaction, order: [["id", "ASC"]] }));
  return chart;
}

function serialize(operation) {
  const loading = operation.state === "succeeded" && operation.phase === "saved"
    && new Date(operation.deadline).getTime() > Date.now();
  return { requestId: operation.request_id, state: loading ? "running" : operation.state, phase: operation.phase,
    chartId: operation.chart_id, ...operation.result };
}

async function findOperation(projectId, userId, requestId) {
  if (!UUID.test(requestId)) throw fail("Invalid chart request.");
  const operation = await db.ChartCreation.findOne({ where: { project_id: projectId, user_id: userId, request_id: requestId } });
  if (!operation) throw fail("This chart request is no longer available.", 404);
  if (operation.state === "running" && new Date(operation.deadline).getTime() <= Date.now()) {
    await db.ChartCreation.update({ state: "failed", result: { message: "The request took too long. Select a source or dataset and try again." } },
      { where: { id: operation.id, state: "running" } });
    await operation.reload();
  }
  return operation;
}

async function status(projectId, userId, requestId) {
  await getAccess(projectId, userId);
  return serialize(await findOperation(projectId, userId, requestId));
}

async function cancel(projectId, userId, requestId) {
  await getAccess(projectId, userId);
  const operation = await findOperation(projectId, userId, requestId);
  await db.ChartCreation.update({ state: "cancelled" }, { where: { id: operation.id, state: "running" } });
  return serialize(await operation.reload());
}

async function searchDatasets(access, projectId, query = "", offset = 0, fixed = {}) {
  const terms = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  const where = { team_id: access.teamId, draft: false };
  if (fixed.datasetId) where.id = fixed.datasetId;
  const datasets = await db.Dataset.findAll({ where, order: [["updatedAt", "DESC"]], limit: 100, offset,
    include: [{ model: db.DataRequest, attributes: ["connection_id"], include: [{ model: db.Connection, attributes: ["id", "name", "type", "subType", "schema"] }] }] });
  const visible = datasets.filter((dataset) => {
    const text = [dataset.name, dataset.legend, ...Object.keys(dataset.fieldsSchema || {})].join(" ").toLowerCase();
    return (!terms.length || terms.some((term) => text.includes(term))) && (access.allProjects || (dataset.project_ids || []).some((id) => access.projectIds.includes(Number(id))))
    && (!fixed.connectionId || dataset.DataRequests.every((request) => Number(request.connection_id) === Number(fixed.connectionId)));
  });
  visible.sort((a, b) => Number((b.project_ids || []).includes(Number(projectId))) - Number((a.project_ids || []).includes(Number(projectId))));
  return { datasets: visible.map((dataset) => ({ dataset_id: dataset.id, name: dataset.name || dataset.legend,
    fields: access.canConfigureTeam ? Object.keys(dataset.fieldsSchema || {}) : [], connection_ids: dataset.DataRequests.map((request) => request.connection_id),
    connectionName: [...new Set(dataset.DataRequests.map((request) => request.Connection?.name).filter(Boolean))].join(", "),
    connections: [...new Map(dataset.DataRequests.filter((request) => request.Connection).map(({ Connection: connection }) => [connection.id, {
      id: connection.id, name: connection.name, type: connection.type, subType: connection.subType,
      icon: connection.schema?.mcp?.server?.icon,
    }])).values()],
  })), truncated: datasets.length === 100, nextOffset: offset + datasets.length };
}

function validateInput(body, chartId) {
  if (!body || !UUID.test(body.requestId || "")) throw fail("Invalid chart request.");
  if (!["prompt", "dataset", "settings"].includes(body.mode)) throw fail("Choose a prompt or dataset.");
  if (body.mode === "settings" && !chartId) throw fail("Select a chart to change.");
  if (body.prompt != null && (typeof body.prompt !== "string" || body.prompt.length > 4000)) throw fail("Use a chart description of up to 4000 characters.");
  if (body.mode === "prompt" && !body.prompt?.trim()) throw fail("Describe the chart you want to create.");
  for (const key of ["datasetId", "connectionId"]) {
    if (body[key] != null && (!Number.isSafeInteger(Number(body[key])) || Number(body[key]) < 1)) throw fail("Choose an available dataset or source.");
  }
  if (body.datasetId && body.connectionId) throw fail("Choose a dataset or a source, not both.");
  if (body.mode === "dataset" && !body.datasetId) throw fail("Choose a dataset.");
  if (chartId && (typeof body.expectedVersion !== "string" || !/^[a-f0-9]{64}$/.test(body.expectedVersion))) throw fail("Reload the chart before changing it.", 409);
  const choices = body.choices || {};
  for (const key of ["xAxis", "yAxis"]) {
    if (choices[key] != null && (typeof choices[key] !== "string" || choices[key].length > 1000)) throw fail("Choose an available chart field.");
  }
  if (!choices || typeof choices !== "object" || Array.isArray(choices) || JSON.stringify(choices).length > 2000) throw fail("Invalid chart settings.");
  if (choices.type && !TYPES.includes(choices.type)) throw fail("Choose a supported chart type.");
  if (choices.yAxisOperation && !OPERATIONS.includes(choices.yAxisOperation)) throw fail("Choose a supported calculation.");
  if (choices.timeInterval && !["second", "minute", "hour", "day", "week", "month", "year"].includes(choices.timeInterval)) throw fail("Choose a valid time interval.");
  if (choices.name != null && (typeof choices.name !== "string" || !choices.name.trim() || choices.name.length > 255)) throw fail("Enter a title of up to 255 characters.");
  const runtime = body.runtime || {};
  if (!runtime || typeof runtime !== "object" || Array.isArray(runtime) || JSON.stringify(runtime).length > 20000
    || (runtime.filters && !Array.isArray(runtime.filters))
    || (runtime.variables && (typeof runtime.variables !== "object" || Array.isArray(runtime.variables)))) throw fail("Invalid dashboard filters.");
  return { requestId: body.requestId, mode: body.mode, prompt: body.prompt?.trim() || "", datasetId: Number(body.datasetId) || null,
    connectionId: Number(body.connectionId) || null, expectedVersion: body.expectedVersion,
    choices: Object.fromEntries(["name", "type", "xAxis", "yAxis", "yAxisOperation", "timeInterval"].filter((key) => choices[key] != null).map((key) => [key, choices[key]])),
    runtime: { filters: runtime.filters || [], variables: runtime.variables || {} } };
}

async function run(projectId, userId, body, chartId = null) {
  let { access, project } = await getAccess(projectId, userId);
  const input = validateInput(body, chartId);
  const hash = fingerprint({ ...input, chartId: Number(chartId) || null });
  const previousRequest = await db.ChartCreation.findOne({ where: { user_id: userId, project_id: projectId, request_id: input.requestId } });
  if (previousRequest) {
    if (previousRequest.input_hash !== hash) throw fail("This request changed. Try it as a new chart request.", 409);
    return status(projectId, userId, input.requestId);
  }
  const originalChart = chartId ? await loadChart(projectId, chartId) : null;
  if (originalChart) {
    const origin = await db.ChartCreation.findOne({ where: { chart_id: chartId, state: "succeeded" }, order: [["createdAt", "DESC"]] });
    if (!input.datasetId && !input.connectionId) {
      input.datasetId = origin?.dataset_id || null;
      input.connectionId = origin?.connection_id || null;
    }
  }
  if (input.mode === "prompt" && (!access.teamAiEnabled || !getWorkspaceOrchestratorPolicy().enabled || !getChartCreationProvider().client)) {
    throw fail("AI is unavailable. Use a dataset or build manually.", 403);
  }
  if (input.datasetId) await getDataset(access, input.datasetId, input);
  if (input.connectionId) await getConnection(access, input.connectionId, input);
  const [operation, created] = await db.ChartCreation.findOrCreate({
    where: { user_id: userId, project_id: projectId, request_id: input.requestId },
    defaults: { team_id: access.teamId, action: chartId ? "refine" : "create", chart_id: chartId,
      input_hash: hash, dataset_id: input.datasetId, connection_id: input.connectionId, deadline: new Date(Date.now() + 120000) },
  });
  if (operation.input_hash !== hash) throw fail("This request changed. Try it as a new chart request.", 409);
  if (!created) return status(projectId, userId, input.requestId);
  const checkActive = async (phase) => {
    await operation.reload();
    if (operation.state !== "running") throw fail("Chart creation was cancelled.", 409);
    const remaining = new Date(operation.deadline).getTime() - Date.now();
    if (remaining <= 0) throw fail("The request took too long. Select a source or dataset and try again.", 422);
    if (phase) await db.ChartCreation.update({ phase }, { where: { id: operation.id, state: "running" } });
    return remaining;
  };
  const inspectDataset = async (id) => {
    const dataset = await getDataset(access, id, input);
    const result = await callTool("run_existing_dataset", { dataset_id: dataset.id, team_id: access.teamId, user_id: userId,
      can_configure_team: access.canConfigureTeam, allowed_project_ids: access.allProjects ? undefined : access.projectIds, row_limit: 30 });
    return { dataset_id: id, name: dataset.name || dataset.legend, fields: access.canConfigureTeam ? dataset.fieldsSchema : result.columns,
      sourceQueries: access.canConfigureTeam ? dataset.DataRequests.map((request) => request.query || request.configuration?.arguments?.query).filter((query) => typeof query === "string") : undefined,
      defaults: access.canConfigureTeam ? { xAxis: dataset.xAxis, yAxis: dataset.yAxis, yAxisOperation: dataset.yAxisOperation } : {}, ...result };
  };
  const preparePlan = async (plan) => {
    await checkActive("checking");
    if (!plan || (plan.dataset_id && plan.connection_id) || typeof plan.name !== "string" || !plan.name.trim() || plan.name.length > 255) throw fail("The chart could not be prepared. Change the request and try again.", 422);
    const scopedPlan = { ...plan, project_id: project.id, team_id: access.teamId, original_question: input.prompt };
    if (originalChart) {
      const previous = originalChart.getDataValue("ChartDatasetConfigs")[0];
      scopedPlan.spec = { ...originalChart.toJSON(), ...(Number(plan.dataset_id) === Number(previous?.dataset_id) ? previous?.toJSON() : {}), ...plan.spec };
      delete scopedPlan.spec.visualization;
      if (input.mode === "settings") {
        scopedPlan.visualization = applyChartCompatibilityUpdate(
          remapVisualizationBindings(originalChart.visualization, [previous], [{ id: "binding-1" }]), input.choices
        );
        for (const layer of scopedPlan.visualization.layers) {
          const encoding = layer.encoding;
          const grouping = encoding.location || encoding.time || encoding.category;
          if (input.choices.xAxis && grouping) grouping.field = input.choices.xAxis;
          if (input.choices.yAxis && encoding.value) encoding.value.field = input.choices.yAxis;
          if (input.choices.yAxisOperation && encoding.value) encoding.value.aggregate = input.choices.yAxisOperation;
        }
      }
    }
    let prepared;
    let data;
    let dataset;
    let allowedFields;
    if (plan.dataset_id) {
      dataset = await getDataset(access, plan.dataset_id, input);
      if (input.mode === "prompt" && !access.canConfigureTeam) {
        const profile = await db.DatasetIntelligence.findOne({ where: { dataset_id: dataset.id, team_id: access.teamId, status: "ready" } });
        allowedFields = getSafeViewerFields(profile?.profile, access.projectIds);
      }
      data = (await datasetController.runRequest({ dataset_id: dataset.id, getCache: true, team_id: access.teamId,
        timezone: project.timezone, variables: input.runtime.variables, filters: input.runtime.filters,
        maintainDatasetMetadata: false, deadlineAt: new Date(operation.deadline).getTime(), viewerScope: `inline-${userId}` })).data;
      prepared = await createChart(scopedPlan, { prepareOnly: true, rows: Array.isArray(data) ? data : undefined });
    } else {
      const connection = await getConnection(access, plan.connection_id, input);
      const sourceDefinition = findSourceForConnection(connection);
      if (sourceDefinition.id === "api" && (scopedPlan.method || scopedPlan.configuration?.method || "GET") !== "GET") throw fail("Use a saved dataset for this API request.", 403);
      prepared = await prepareDashboardChart(scopedPlan, { prepareOnly: true });
      const request = prepared.datasetData.dataRequests[0];
      if (sourceDefinition.id === "api" && (request.method || request.configuration?.method || "GET") !== "GET") throw fail("Use a saved dataset for this API request.", 403);
      const source = findSourceForConnection(connection);
      const preview = sourceUsesSourceOwnedConfiguration(source)
        ? await callTool("source_preview_configuration", { team_id: access.teamId, connection_id: connection.id, configuration: request.configuration, row_limit: 100 })
        : await runQuery({ team_id: access.teamId, connection_id: connection.id, query: request.query, row_limit: 100 }, { transient: true });
      if (preview.status && preview.status !== "ok") throw fail("The source could not provide chart data. Check the source or change the request.", 422);
      data = applyTransformation(preview.rows, request.transform);
    }
    if (data == null || (Array.isArray(data) && !data.length)) throw fail("No data for this period. Change the period or select another dataset.", 422);
    const chartData = prepared.chartData;
    const limit = plan.maxRecords ?? plan.spec?.maxRecords;
    const sort = plan.sort ?? plan.spec?.sort;
    chartData.visualization = applyChartLimit(chartData.visualization, { maxRecords: limit, sort });
    if (limit != null) chartData.chartDatasetConfigs[0].maxRecords = limit;
    if (sort) chartData.chartDatasetConfigs[0].sort = sort;
    if (plan.startDate || plan.endDate) {
      if (!plan.startDate || !plan.endDate || !Number.isFinite(Date.parse(plan.startDate)) || !Number.isFinite(Date.parse(plan.endDate))
        || Date.parse(plan.startDate) > Date.parse(plan.endDate)) throw fail("The chart period is invalid. Specify the dates and try again.", 422);
      Object.assign(chartData, { startDate: plan.startDate, endDate: plan.endDate,
        currentEndDate: plan.currentEndDate === true, fixedStartDate: plan.fixedStartDate === true });
    }
    chartData.draft = false;
    chartData.onReport = true;
    const bindings = chartData.chartDatasetConfigs;
    if (allowedFields && bindings.some((binding) => [binding.xAxis, binding.yAxis, binding.dateField]
      .filter(Boolean).some((field) => !allowedFields.includes(field)))) {
      throw fail("Use an available dataset field or ask an administrator to prepare this chart.", 403);
    }
    chartData.visualization = remapVisualizationBindings(chartData.visualization, bindings, [{ id: "binding-1" }]);
    if (bindings.length !== 1 || chartData.visualization.layers.some((layer) => String(layer.bindingId) !== "binding-1")) throw fail("Use More options for this chart configuration.", 422);
    const fields = discoverDatasetFieldsSchema(data);
    if (prepared.datasetData) prepared.datasetData.fieldsSchema = fields;
    for (const layer of chartData.visualization.layers) {
      if (input.mode === "prompt" && !input.datasetId && layer.mark === "map"
        && (layer.options?.map?.area || "world") === "world" && layer.options?.map?.mode !== "points") {
        const locations = findRows(data).map((row) => getFieldValue(row, layer.encoding.location.field)).filter(Boolean);
        if (!locations.length || locations.some((location) => !getMap("world").names.has(String(location).toUpperCase()))) {
          throw fail("Use the source's country-code field for this world map. Inspect the connection and prepare country-level data instead of reusing names or business regions.", 422);
        }
      }
      for (const encoding of Object.values(layer.encoding || {}).flat()) {
        if (allowedFields && encoding.field && !allowedFields.includes(encoding.field)) {
          throw fail("Use an available dataset field or ask an administrator to prepare this chart.", 403);
        }
        if (encoding.field && encoding.field !== "root[]" && !fields[encoding.field]) {
          throw fail("A chart field is no longer available. Select another field or dataset.", 422);
        }
      }
    }
    const cdc = { ...bindings[0], id: "binding-1" };
    const compiled = new VisualizationEngine({ chart: { ...chartData, ChartDatasetConfigs: [cdc] },
      datasets: [{ data, options: resolveChartDatasetOptions(cdc, dataset) }], timezone: project.timezone,
    }).render({ filters: input.runtime.filters, variables: input.runtime.variables });
    if (!compiled.preparedData.results.some((result) => result.rows?.length)) {
      const warnings = compiled.preparedData.warnings?.map((warning) => warning.message).filter(Boolean).join(" ");
      throw fail(warnings || "No data matches these filters. Change the period or filters and try again.", 422);
    }
    return { prepared, chartData, bindings, fields, dataset };
  };
  try {
    if (originalChart && chartVersion(originalChart) !== input.expectedVersion) throw fail("This chart changed. Reload it before trying again.", 409);
    let plan;
    let validated;
    if (input.mode === "prompt") {
      const dashboardBindings = await db.ChartDatasetConfig.findAll({
        attributes: ["dataset_id"], include: [{ model: db.Chart, attributes: [], required: true, where: { project_id: project.id } }], limit: 100,
      });
      const result = await planInlineChart({ access, input, dashboard: { name: project.name, datasetIds: [...new Set(dashboardBindings.map((binding) => binding.dataset_id))], timezone: project.timezone }, chart: originalChart ? {
        name: originalChart.name, type: originalChart.type, timeInterval: originalChart.timeInterval,
        visualization: originalChart.visualization, bindings: originalChart.getDataValue("ChartDatasetConfigs"),
      } : null, checkActive, inspectDataset,
      prepareChart: async (candidate) => { validated = await preparePlan(candidate); },
      runScopedTool: async (name, args, runner) => {
        await checkActive("finding");
        if (name === "get_dataset_intelligence" && !access.canConfigureTeam) return inspectDataset(args.dataset_id);
        if (name === "search_datasets") {
          const offset = Math.max(0, Number(args.offset) || 0);
          const found = await searchDatasets(access, projectId, args.query, offset, input);
          if (offset || !access.canConfigureTeam) return found;
          const indexed = await runner(name, { query: args.query, team_id: access.teamId, limit: 10 });
          const matches = [];
          for (const candidate of indexed.datasets || []) {
            try {
              // oxlint-disable-next-line no-await-in-loop
              await getDataset(access, candidate.dataset_id, input);
              matches.push(candidate);
            } catch (_) { /* The selected source can exclude an indexed match. */ }
          }
          return { ...found, datasets: [...matches, ...found.datasets.filter((item) => !matches.some((match) => match.dataset_id === item.dataset_id))] };
        }
        if (args.dataset_id) await getDataset(access, args.dataset_id, input);
        if (args.connection_id) {
          const connection = await getConnection(access, args.connection_id, input);
          const source = findSourceForConnection(connection);
          if (name === "source_run_action" && !["jira", "customerio"].includes(source.id)) throw fail("Use source_plan_dataset and source_preview_configuration to inspect data from this source.", 422);
          if (source.id === "api" && ["source_preview_configuration", "source_get_sample_data"].includes(name)
            && (args.configuration?.method || "GET") !== "GET") throw fail("Use a saved dataset for this API request.", 403);
        }
        if (name === "run_query") return runQuery({ ...args, team_id: access.teamId }, { transient: true });
        if (name === "list_connections" && input.connectionId) {
          const connection = await getConnection(access, input.connectionId, input);
          return { connections: [{ id: connection.id, name: connection.name, type: connection.type, subType: connection.subType }] };
        }
        if (name === "list_connections") return listConnections({ ...args, project_id: undefined, team_id: access.teamId, user_id: userId }, { limit: 100, offset: args.offset });
        return runner(name, { ...args, project_id: project.id, team_id: access.teamId, user_id: userId, can_configure_team: access.canConfigureTeam,
          allowed_project_ids: access.allProjects ? undefined : access.projectIds, original_question: input.prompt });
      } });
      if (result.question) {
        await db.ChartCreation.update({ state: "needs_input", result: { question: result.question } }, { where: { id: operation.id, state: "running" } });
        return serialize(await operation.reload());
      }
      plan = result.plan;
    } else {
      const datasetId = input.datasetId || originalChart?.getDataValue("ChartDatasetConfigs")?.[0]?.dataset_id;
      const dataset = await getDataset(access, datasetId, input);
      const data = await datasetController.runRequest({ dataset_id: dataset.id, getCache: true, team_id: access.teamId,
        timezone: project.timezone, variables: input.runtime.variables, filters: input.runtime.filters, maintainDatasetMetadata: false, deadlineAt: new Date(operation.deadline).getTime(), viewerScope: `inline-${userId}` });
      if (data.data == null || (Array.isArray(data.data) && !data.data.length)) throw fail("No data for this period. Change the period or select another dataset.", 422);
      const fields = discoverDatasetFieldsSchema(data.data);
      let defaults = dataset.toJSON();
      if (!defaults.yAxis || !defaults.yAxisOperation) {
        const previousConfigs = await db.ChartDatasetConfig.findAll({ where: { dataset_id: dataset.id },
          include: [{ model: db.Chart, attributes: ["project_id"], required: true }], limit: 100 });
        const candidates = previousConfigs.filter((config) => fields[config.yAxis] && OPERATIONS.includes(config.yAxisOperation)
          && (access.allProjects || access.projectIds.includes(config.Chart.project_id)));
        const unique = new Map(candidates.map((config) => {
          const value = { xAxis: config.xAxis, yAxis: config.yAxis, yAxisOperation: config.yAxisOperation, dateField: config.dateField, dateFormat: config.dateFormat };
          return [fingerprint(value), value];
        }));
        if (unique.size === 1) defaults = { ...defaults, ...[...unique.values()][0] };
      }
      const currentCdc = originalChart?.getDataValue("ChartDatasetConfigs")?.[0];
      const cdc = Number(currentCdc?.dataset_id) === dataset.id ? currentCdc : null;
      if (originalChart?.getDataValue("ChartDatasetConfigs")?.length > 1) throw fail("Use More options to change this chart.", 422);
      plan = datasetDefaults(cdc ? { ...defaults, ...cdc.toJSON(), ...getInlineBindings(originalChart), name: originalChart.name } : defaults, fields,
        { ...(originalChart ? { type: originalChart.type } : {}), ...input.choices }, Array.isArray(data.data) ? data.data.length : 1);
      if (plan.question) {
        await db.ChartCreation.update({ state: "needs_input", result: plan }, { where: { id: operation.id, state: "running" } });
        return serialize(await operation.reload());
      }
      plan = { ...plan, ...input.choices, dataset_id: dataset.id,
        timeInterval: input.choices.timeInterval || originalChart?.timeInterval || "day" };
    }
    const result = validated || await preparePlan(plan);
    const { prepared, chartData, bindings, fields } = result;
    let { dataset } = result;
    await checkActive("saving");
    await db.sequelize.transaction(async (transaction) => {
      const locked = await db.ChartCreation.findByPk(operation.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (locked.state !== "running" || new Date(locked.deadline).getTime() <= Date.now()) throw fail("Chart creation was cancelled or took too long.", 409);
      ({ access, project } = await getAccess(projectId, userId));
      if (input.mode === "prompt" && (!access.teamAiEnabled || !getWorkspaceOrchestratorPolicy().enabled)) throw fail("AI is no longer available.", 403);
      if (plan.dataset_id) dataset = await getDataset(access, plan.dataset_id, input, transaction);
      else {
        await getConnection(access, plan.connection_id, input, transaction);
        dataset = await datasetController.createWithDataRequests(prepared.datasetData, { transaction });
      }
      bindings[0].dataset_id = dataset.id;
      const lockedDataset = await db.Dataset.findByPk(dataset.id, { transaction, lock: transaction.LOCK.UPDATE });
      await lockedDataset.update({ project_ids: [...new Set([...(lockedDataset.project_ids || []).map(Number), project.id])] }, { transaction });
      let chart;
      if (originalChart) {
        chart = await loadChart(projectId, chartId, transaction);
        if (chartVersion(chart) !== input.expectedVersion) throw fail("This chart changed. Reload it before trying again.", 409);
        const existing = chart.getDataValue("ChartDatasetConfigs");
        if (existing.length !== 1) throw fail("Use More options to change this chart.", 422);
        const updates = { ...chartData };
        ["chartDatasetConfigs", "project_id", "layout"].forEach((key) => delete updates[key]);
        await existing[0].update({ ...bindings[0], id: existing[0].id, chart_id: chart.id }, { transaction });
        updates.visualization = remapVisualizationBindings(chartData.visualization, bindings, existing);
        await chart.update(updates, { transaction });
      } else {
        chart = await chartController.createWithChartDatasetConfigs(chartData, { id: userId }, { transaction, skipBackgroundUpdate: true });
      }
      const current = await db.Project.findByPk(projectId, { transaction });
      await locked.update({ state: "succeeded", chart_id: chart.id, phase: "saved", result: { layoutRevision: current.layoutRevision, fields } }, { transaction });
    });
    await operation.reload();
    try {
      await chartController.updateChartData(operation.chart_id, { id: userId }, { getCache: true, ...input.runtime });
    } catch (_) {
      await operation.update({ result: { ...operation.result, message: "Chart saved. Refresh the chart to load its data." } });
    }
    await operation.update({ phase: "ready" });
  } catch (error) {
    await db.ChartCreation.update({ state: "failed", result: { message: error.statusCode ? error.message : "The chart could not be prepared. Check the data source and try again." } },
      { where: { id: operation.id, state: "running" } });
  }
  return serialize(await operation.reload());
}

async function details(projectId, userId, chartId) {
  const { access } = await getAccess(projectId, userId);
  const chart = await loadChart(projectId, chartId);
  const cdc = chart.getDataValue("ChartDatasetConfigs")[0];
  const dataset = cdc ? await getDataset(access, cdc.dataset_id) : null;
  const saved = await db.ChartCreation.findOne({ where: { chart_id: chart.id, state: "succeeded" }, order: [["updatedAt", "DESC"]] });
  return { version: chartVersion(chart), name: chart.name, type: chart.type, timeInterval: chart.timeInterval,
    datasetId: dataset?.id, fields: saved?.result?.fields || dataset?.fieldsSchema || {}, xAxis: cdc?.xAxis || dataset?.xAxis, yAxis: cdc?.yAxis || dataset?.yAxis, yAxisOperation: cdc?.yAxisOperation || dataset?.yAxisOperation,
    ...getInlineBindings(chart) };
}

module.exports = { run, status, cancel, details, searchDatasets, getAccess, validateInput, chartVersion };
