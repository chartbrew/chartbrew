const { Op } = require("sequelize");
const db = require("../../models/models");
const DataApiController = require("../../controllers/DataApiController");
const DatasetController = require("../../controllers/DatasetController");
const ChartImageController = require("../../controllers/ChartImageController");
const { canReadDataset, findAccessibleDataset, TEAM_WIDE_ROLES } = require("../dataApiAccess");
const { DataApiError, serializeDataApiResponse } = require("../dataApiResponse");
const { withExecutionDeadline } = require("../dataApiLimits");
const { readWorkspaceActivity } = require("../workspaceContext/workspaceActivityProjection");
const { startRun, completeRun, failRun } = require("../updateAudit");
const { findSourceForConnection } = require("../../sources");
const { isSourceServerEnabled } = require("../../sources/sourceAvailability");
const createTemporaryChart = require("../ai/orchestrator/tools/createTemporaryChart");
const { TOOLS } = require("./tools");
const { getFieldValue, selectRows } = require("../../visualization/fieldPath");

const dataController = new DataApiController();
const datasetController = new DatasetController();
const imageController = new ChartImageController();

function clientLink(path) {
  const host = process.env.NODE_ENV === "production" ? process.env.VITE_APP_CLIENT_HOST : process.env.VITE_APP_CLIENT_HOST_DEV;
  return host && URL.canParse(path, host) ? new URL(path, host).href : null;
}

function requireSourceAccess(access) {
  // ponytail: team-wide only; project-scoped writes need source and preview ownership checks first.
  if (!TEAM_WIDE_ROLES.has(access.role) || !access.allProjects) throw new DataApiError("API_KEY_SCOPE_REQUIRED");
}

async function searchWorkspace(access, { query = "", types = ["dashboard", "chart", "dataset"], limit = 20 }, signal) {
  const results = [];
  const name = { [Op.like]: `%${query.replace(/[\\%_]/g, "\\$&")}%` };
  if (types.includes("dashboard")) {
    const projects = await db.Project.findAll({ attributes: ["id", "name"],
      where: { id: { [Op.in]: access.projectIds }, team_id: access.teamId, ghost: false, name }, order: [["id", "ASC"]], limit });
    results.push(...projects.map((item) => ({ type: "dashboard", id: item.id, name: item.name, url: clientLink(`/dashboard/${item.id}`) })));
  }
  if (types.includes("chart")) {
    const charts = await db.Chart.findAll({ attributes: ["id", "name", "project_id"],
      where: { project_id: { [Op.in]: access.projectIds }, name },
      include: [{ model: db.Project, attributes: ["name"], where: { team_id: access.teamId, ghost: false }, required: true }],
      order: [["id", "ASC"]], limit });
    results.push(...charts.map((item) => ({ type: "chart", id: item.id, name: item.name,
      dashboard: { id: item.project_id, name: item.Project.name }, url: clientLink(`/dashboard/${item.project_id}/chart/${item.id}/edit`) })));
  }
  if (types.includes("dataset")) {
    // JSON project membership differs between MySQL and Postgres; scan bounded pages, not all rows in memory.
    let cursor = 0;
    let count = 0;
    while (count < limit) {
      signal?.throwIfAborted();
      // Pagination depends on the previous page; parallel reads would load the whole catalog.
      // oxlint-disable-next-line no-await-in-loop
      const page = await db.Dataset.findAll({ attributes: ["id", "name", "team_id", "project_ids"],
        where: { id: { [Op.gt]: cursor }, team_id: access.teamId, draft: false, name }, order: [["id", "ASC"]], limit: 100 });
      for (const item of page.filter((dataset) => canReadDataset(access, dataset))) {
        results.push({ type: "dataset", id: item.id, name: item.name, url: clientLink(`/datasets/${item.id}`) });
        count += 1;
        if (count === limit) break;
      }
      if (page.length < 100) break;
      cursor = page[page.length - 1].id;
    }
  }
  return { items: results.slice(0, limit), truncated: results.length >= limit };
}

async function exploreData(access, args) {
  requireSourceAccess(access);
  if (args.operation === "save" && !access.scopes.includes("datasets:write")) throw new DataApiError("API_KEY_SCOPE_REQUIRED");
  if (args.operation === "inspect" && !args.connectionId) {
    const connections = await db.Connection.findAll({ attributes: ["id", "name", "type", "subType"],
      where: { team_id: access.teamId, name: { [Op.like]: `%${args.search || ""}%` } }, order: [["id", "ASC"]], limit: (args.limit || 20) + 1 });
    return { truncated: connections.length > (args.limit || 20), connections: connections.slice(0, args.limit || 20).map((connection) => {
      const source = findSourceForConnection(connection);
      return { id: connection.id, name: connection.name, source: source?.name || connection.type,
        canExplore: Boolean(source && isSourceServerEnabled(source) && source.backend?.exploreReadOnly) };
    }) };
  }
  if (!args.connectionId) throw new DataApiError("INVALID_REQUEST");
  if (args.operation === "save" && (!args.name?.trim() || !args.projectId || !access.projectIds.includes(args.projectId))) {
    throw new DataApiError("INVALID_REQUEST");
  }
  const connection = await db.Connection.findOne({ where: { id: args.connectionId, team_id: access.teamId } });
  if (!connection) throw new DataApiError("RESOURCE_NOT_FOUND");
  const source = findSourceForConnection(connection);
  if (!source || !isSourceServerEnabled(source) || !source.backend?.exploreReadOnly) {
    return { status: "unsupported", message: "Explore this source in Chartbrew and save a dataset first. You can then read it with run_dataset." };
  }
  const preview = await withExecutionDeadline(() => source.backend.exploreReadOnly({ ...args, connection, limit: args.limit || 20 }));
  const { dataRequest, ...result } = preview;
  serializeDataApiResponse(result);
  if (args.operation !== "save") return result;
  if (!dataRequest || !Array.isArray(result.rows) || !result.rows.length || (result.status && result.status !== "ok")) {
    return { ...result, status: "not_saved", message: "The request did not return usable rows. Check the preview before saving a dataset." };
  }
  const project = await db.Project.findOne({ where: { id: args.projectId, team_id: access.teamId, ghost: false }, attributes: ["id"] });
  if (!project) throw new DataApiError("RESOURCE_NOT_FOUND");
  const dataset = await db.sequelize.transaction((transaction) => datasetController.createWithDataRequests({
    team_id: access.teamId, project_ids: [project.id], name: args.name.trim(), draft: false,
    dataRequests: [{ ...dataRequest, connection_id: connection.id }], main_dr_index: 0,
  }, { transaction }));
  return { status: "saved", dataset: { id: dataset.id, name: dataset.name, url: clientLink(`/datasets/${dataset.id}`) } };
}

async function createPreview(req, args) {
  const access = req.apiKeyAccess;
  requireSourceAccess(access);
  const dataset = await findAccessibleDataset(db, access, access.teamId, args.datasetId);
  if (!dataset) throw new DataApiError("RESOURCE_NOT_FOUND");
  if (args.type !== "table" && (!args.yAxis || (args.type !== "kpi" && !args.xAxis))) throw new DataApiError("INVALID_REQUEST");
  const data = await dataController.datasetData({ id: req.id, method: "POST", apiKeyAccess: access, body: {},
    params: { team_id: String(access.teamId), dataset_id: String(dataset.id) } });
  const rows = selectRows(data.body.data, [args.xAxis, args.yAxis]);
  if (!rows.length) return { result: { status: "not_created", message: "This dataset has no rows to chart. Check its data and filters first." } };
  if (args.type !== "table") {
    const values = rows.map((row) => getFieldValue(row, args.yAxis)).filter((value) => value != null);
    if (!values.length || values.some((value) => !["number", "string"].includes(typeof value) || String(value).trim() === "" || !Number.isFinite(Number(value)))) {
      return { result: { status: "not_created", message: "Select a numeric value field from run_dataset before creating this chart." } };
    }
    if (args.xAxis && rows.every((row) => getFieldValue(row, args.xAxis) == null)) throw new DataApiError("INVALID_REQUEST");
  }
  const preview = await createTemporaryChart({ team_id: access.teamId, dataset_id: dataset.id,
    name: args.name, type: args.type, xAxis: args.xAxis, yAxis: args.yAxis, skipSnapshot: true });
  const result = { status: "preview", chart: { id: preview.chart_id, name: preview.name, type: preview.type,
    url: clientLink(`/dashboard/${preview.project_id}/chart/${preview.chart_id}/edit`) },
  dataset: { id: dataset.id, name: dataset.name, url: clientLink(`/datasets/${dataset.id}`) } };
  let image;
  if (args.includeImage) {
    try {
      const png = await withExecutionDeadline(({ signal }) => imageController.render({ id: req.id,
        user: { id: access.userId }, params: { chart_id: String(preview.chart_id), project_id: String(preview.project_id) }, body: {},
      }, { signal }));
      if (png.length <= 1024 * 1024) image = { type: "image", mimeType: "image/png", data: png.toString("base64") };
      else result.imageUnavailable = true;
    } catch (_error) {
      result.imageUnavailable = true;
    }
  }
  return { result, image };
}

async function execute(req, name, args) {
  const access = req.apiKeyAccess;
  if (name === "search_workspace") return { result: await withExecutionDeadline(({ signal }) => searchWorkspace(access, args, signal)) };
  if (name === "explore_data") return { result: await exploreData(access, args) };
  if (name === "create_chart_preview") return createPreview(req, args);
  if (name === "get_workspace_activity") {
    // Always use the effective project IDs, even when the key owner is a team admin.
    return { result: await withExecutionDeadline(() => readWorkspaceActivity({ ...access, allProjects: false }, {
      ...args, observationLimit: args.limit, evaluationLimit: args.limit, includeHealth: false, includeAlerts: false,
    })) };
  }
  const { datasetId, chartId, projectId, ...body } = args;
  const request = { id: req.id, method: "POST", apiKeyAccess: access, body,
    params: { team_id: String(access.teamId), dataset_id: String(datasetId), chart_id: String(chartId), project_id: String(projectId) } };
  const response = name === "run_dataset" ? await dataController.datasetData(request) : await dataController.chartData(request);
  return { result: response.body };
}

async function callMcpTool(req, name, args) {
  const access = req.apiKeyAccess;
  const definition = TOOLS.find((item) => item.name === name);
  const trace = await startRun({ triggerType: "mcp", entityType: "mcp_tool", apiKeyId: access.apiKeyId,
    teamId: access.teamId, summary: { tool: name, requestId: req.id } });
  try {
    if (!definition || !access.scopes.includes(definition.scope)) throw new DataApiError("API_KEY_SCOPE_REQUIRED");
    const { result, image } = await execute(req, name, args);
    const response = { content: [{ type: "text", text: `${name}: ${result.status || "complete"}.` }], structuredContent: { result } };
    if (image) response.content.push(image);
    serializeDataApiResponse(response);
    await completeRun(trace, { status: "success", summary: { tool: name } });
    return response;
  } catch (error) {
    const safe = error instanceof DataApiError ? error : new DataApiError(error?.code === "EXECUTION_TIMEOUT" ? "EXECUTION_TIMEOUT" : "DATA_UNAVAILABLE");
    await failRun(trace, safe, { stage: "mcp", summary: { tool: name, errorCode: safe.code } });
    return { isError: true, content: [{ type: "text", text: `${safe.code}: ${safe.message}` }] };
  }
}

module.exports = { callMcpTool };
