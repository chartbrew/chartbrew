const _ = require("lodash");

const DatasetController = require("../../../../controllers/DatasetController");
const db = require("../../../../models/models");
const { requireDatasetForTeam } = require("./teamScope");

const datasetController = new DatasetController();
const SENSITIVE_FIELD_PATTERN = /(^|[._])(address|bank|card|iban|ip_address|mobile|password|payment|phone|postal|routing|secret|ssn|tax_id|token|zip)($|[._])/i;

function findRows(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.values(value).find(Array.isArray) || [];
}

function getSafeViewerFields(profile, allowedProjectIds) {
  if (!profile?.usage || !profile?.fields || !Array.isArray(allowedProjectIds)) return [];
  const allowed = new Set(allowedProjectIds.map(Number));
  const usedFields = [
    ...(profile.usage.metrics || []),
    ...(profile.usage.dimensions || []),
    ...(profile.usage.filters || []),
  ].filter((usage) => allowed.has(Number(usage.dashboardId)))
    .map((usage) => usage.field);
  return [...new Set(usedFields)].filter((field) => {
    const definition = profile.fields[field];
    return definition
      && definition.role !== "identifier"
      && !["email", "url"].includes(definition.semanticType)
      && !SENSITIVE_FIELD_PATTERN.test(field);
  }).slice(0, 30);
}

function projectRows(rows, fields) {
  return rows.map((row) => Object.fromEntries(fields.map((field) => [
    field,
    _.get(row, `${field}`.replace(/^root\[\]\.?/, "").replace(/^root\.?/, "")),
  ])));
}

async function runExistingDataset(payload) {
  const {
    allowed_project_ids: allowedProjectIds,
    can_configure_team: canConfigureTeam,
    dataset_id: datasetId,
    row_limit: rowLimit = 100,
    team_id: teamId,
    user_id: userId,
  } = payload;
  const dataset = await requireDatasetForTeam(datasetId, teamId);
  const projectIds = Array.isArray(dataset.project_ids) ? dataset.project_ids : [];
  if (
    Array.isArray(allowedProjectIds)
    && !projectIds.some((projectId) => allowedProjectIds.includes(Number(projectId)))
  ) {
    throw new Error("Dataset is not available in your projects");
  }
  const result = await datasetController.runRequest({
    dataset_id: dataset.id,
    getCache: true,
    team_id: teamId,
    viewerScope: `ai-user-${userId}`,
  });
  const safeLimit = Math.min(Math.max(Number.parseInt(rowLimit, 10) || 100, 1), 200);
  const rows = findRows(result.data);
  if (!canConfigureTeam) {
    const intelligence = await db.DatasetIntelligence.findOne({
      attributes: ["profile", "status"],
      where: {
        dataset_id: dataset.id,
        status: "ready",
        team_id: teamId,
      },
    });
    const fields = getSafeViewerFields(intelligence?.profile, allowedProjectIds);
    if (fields.length === 0) {
      throw new Error("This dataset is not ready for safe analysis");
    }
    return {
      columns: fields,
      rowCount: rows.length,
      rows: projectRows(rows.slice(0, safeLimit), fields),
      truncated: rows.length > safeLimit,
    };
  }
  return {
    columns: rows[0] ? Object.keys(rows[0]).slice(0, 100) : [],
    rowCount: rows.length,
    rows: rows.slice(0, safeLimit),
    truncated: rows.length > safeLimit,
  };
}

module.exports = runExistingDataset;
module.exports.findRows = findRows;
module.exports.getSafeViewerFields = getSafeViewerFields;
module.exports.projectRows = projectRows;
