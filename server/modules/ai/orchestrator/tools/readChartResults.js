const { Op } = require("sequelize");
const db = require("../../../../models/models");
const { getObservationAccess, getProjectScope } = require("../../../observations/access");
const { loadPreparedSnapshots, compilePreparedRender } = require("../../../preparedSnapshot");
const runtimeCache = require("../../../runtimeCache");
const { sanitizeText, sanitizeUntrustedText } = require("../runtime/egressBoundary");

function boundedValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  return sanitizeUntrustedText(typeof value === "object" ? JSON.stringify(value) : value, 200);
}

async function readChartResults(payload) {
  const access = await getObservationAccess(payload.team_id, payload.user_id);
  const projectId = Number(payload.project_id);
  if (!Number.isInteger(projectId) || projectId < 1) throw new Error("Select a dashboard to read.");
  const project = await db.Project.findOne({
    attributes: ["id", "name", "timezone"],
    where: { team_id: access.teamId, ...getProjectScope(access, "id"), [Op.and]: { id: projectId }, ghost: false },
  });
  if (!project || (Array.isArray(payload.allowed_project_ids)
    && !payload.allowed_project_ids.includes(projectId))) {
    throw new Error("This dashboard is not available.");
  }
  const offset = payload.offset ?? 0;
  if (!Number.isInteger(offset) || offset < 0) throw new Error("Invalid chart offset.");
  const charts = await db.Chart.findAll({
    where: { project_id: projectId, draft: false },
    order: [["id", "ASC"]],
    limit: 26,
    offset,
  });
  const selected = charts.slice(0, 25);
  const snapshots = await loadPreparedSnapshots(selected.map((chart) => chart.id));
  const results = await Promise.all(selected.map(async (chart) => {
    const snapshot = snapshots.get(Number(chart.id));
    const item = {
      chartId: chart.id,
      name: sanitizeText(chart.name, 160),
      project: { id: project.id, name: sanitizeText(project.name, 160) },
      type: chart.type,
      view: "saved_default",
      updatedAt: snapshot?.updatedAt || null,
      status: "unavailable",
    };
    if (!snapshot) return item;
    try {
      const fingerprints = await runtimeCache.buildChartFingerprints(chart.id, project.timezone);
      if (snapshot.visualizationFingerprint !== fingerprints.visualization) {
        item.status = "configuration_changed";
        return item;
      }
      const rendered = compilePreparedRender(chart, snapshot.preparedData, {
        timezone: snapshot.preparedData.timezone || project.timezone,
      });
      item.status = "available";
      item.sourceChanged = snapshot.sourceFingerprint !== fingerprints.source;
      item.timeRange = rendered.render.metadata.timeRange;
      item.timezone = snapshot.preparedData.timezone || project.timezone;
      const metrics = ["kpi", "avg", "gauge"].includes(chart.type)
        ? rendered.render.metadata.metrics || [] : [];
      item.metrics = metrics.slice(0, 10).map((metric) => ({
        label: sanitizeUntrustedText(metric.label, 160),
        value: boundedValue(metric.value),
        valueNumber: metric.valueNumber,
        displayedComparison: metric.comparison,
      }));
      let remainingRows = 30;
      item.tables = Object.entries(rendered.render.tabularData).slice(0, 10).map(([label, rows]) => {
        const selectedRows = remainingRows > 0 ? rows.slice(-remainingRows) : [];
        remainingRows -= selectedRows.length;
        const columns = Object.keys(rows[0] || {}).slice(0, 12);
        const truncated = rows.length > selectedRows.length
          || rows.some((row) => Object.keys(row).length > columns.length);
        return {
          label: sanitizeUntrustedText(label, 160),
          columns: columns.map((column) => sanitizeUntrustedText(column, 160)),
          values: selectedRows.map((row) => columns.map((column) => boundedValue(row[column]))),
          rowCount: rows.length,
          truncated,
        };
      });
      item.truncated = Object.keys(rendered.render.tabularData).length > 10
        || metrics.length > 10
        || item.tables.some((table) => table.truncated);
      for (const table of item.tables) {
        while (table.values.length > 0 && JSON.stringify(item).length > 6000) {
          table.values.shift();
          table.truncated = true;
          item.truncated = true;
        }
      }
      while (item.tables.length > 0 && JSON.stringify(item).length > 6000) {
        item.tables.pop();
        item.truncated = true;
      }
    } catch (_) {
      item.status = "unavailable";
      delete item.tables;
      delete item.metrics;
    }
    return item;
  }));
  const items = [];
  let resultCharacters = 0;
  for (const item of results) {
    items.push(item);
    resultCharacters += JSON.stringify(item).length;
    if (resultCharacters >= 18000) break;
  }
  return {
    view: "saved_default",
    guidance: "These are saved default chart results, not active screen filters or live data. Use updatedAt and timeRange. Do not infer trends from a single value, compare incomplete periods, or run datasets when results are missing.",
    items,
    nextOffset: charts.length > items.length ? offset + items.length : null,
    truncated: charts.length > items.length || items.some((item) => item.truncated),
  };
}

module.exports = readChartResults;
