const { Op } = require("sequelize");
const db = require("../../../../models/models");
const ProjectController = require("../../../../controllers/ProjectController");
const { getObservationAccess, assertCanEditProject, getProjectScope } = require("../../../observations/access");
const { sanitizeUntrustedText } = require("../runtime/egressBoundary");

const controller = new ProjectController();

async function requireDashboard(payload, write = false, transaction) {
  const access = await getObservationAccess(payload.team_id, payload.user_id);
  const projectId = Number(payload.project_id);
  if (!Number.isInteger(projectId) || projectId < 1) throw new Error("Select a dashboard.");
  if (write) assertCanEditProject(access, projectId);
  if (Array.isArray(payload.allowed_project_ids) && !payload.allowed_project_ids.includes(projectId)) {
    throw new Error("This dashboard is not available.");
  }
  const project = await db.Project.findOne({
    where: { team_id: access.teamId, ghost: false, ...getProjectScope(access, "id"), [Op.and]: { id: projectId } },
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!project) throw new Error("This dashboard is not available.");
  return project;
}

async function getFields(projectId, transaction) {
  const bindings = await db.ChartDatasetConfig.findAll({
    include: [
      { model: db.Chart, attributes: [], required: true, where: { project_id: projectId, draft: false } },
      { model: db.Dataset, attributes: ["fieldsSchema"], required: true },
    ],
    transaction,
  });
  const fields = Object.create(null);
  for (const binding of bindings) {
    for (const [field, type] of Object.entries(binding.Dataset.fieldsSchema || {})) {
      if (["string", "number", "boolean"].includes(type)) fields[field] = type;
    }
  }
  return fields;
}

function serializeFilter(filter) {
  const config = filter.configuration;
  return {
    id: filter.id,
    onReport: filter.onReport,
    configuration: {
      ...config,
      label: sanitizeUntrustedText(config.label, 160),
      field: sanitizeUntrustedText(config.field, 240),
      allLabel: sanitizeUntrustedText(config.allLabel, 160),
      options: (config.options || []).map((value) => sanitizeUntrustedText(value, 240)),
    },
  };
}

async function listDashboardFilters(payload) {
  const project = await requireDashboard(payload);
  const [filters, fields] = await Promise.all([
    controller.getDashboardFilters(project.id),
    getFields(project.id),
  ]);
  return {
    project_id: project.id,
    filters: filters.map(serializeFilter),
    fields: Object.entries(fields).map(([field, type]) => ({ field: sanitizeUntrustedText(field, 240), type })),
    guidance: "Fields come from saved dataset schemas. Options must come from the user's values or verified source data; do not invent or silently truncate them. Clearing a field filter includes all values.",
  };
}

function validateFilter(payload, fields) {
  const { field, label, options, all_label: allLabel = "All" } = payload;
  if (typeof label !== "string" || !label.trim() || label.length > 160
    || typeof allLabel !== "string" || !allLabel.trim() || allLabel.length > 160) {
    throw new Error("Give the filter and its All option short labels.");
  }
  if (typeof field !== "string" || !Object.hasOwn(fields, field)) {
    throw new Error("Select a field from the dashboard's saved dataset fields.");
  }
  const type = fields[field];
  if (!Array.isArray(options) || !options.length || options.length > 500
    || options.some((value) => typeof value !== type || value === ""
      || (typeof value === "string" && value.length > 240)
      || (typeof value === "number" && !Number.isFinite(value)))
    || new Set(options.map((value) => JSON.stringify(value))).size !== options.length) {
    throw new Error("Provide 1 to 500 distinct options that match the field type. Do not truncate a longer list.");
  }
  if (payload.on_report !== undefined && typeof payload.on_report !== "boolean") {
    throw new Error("Choose whether the filter is shown on reports.");
  }
  return { type: "field", field, label: label.trim(), operator: "is", value: "", dataType: type, options, allLabel: allLabel.trim() };
}

async function setDashboardFilter(payload) {
  return db.sequelize.transaction(async (transaction) => {
    const project = await requireDashboard(payload, true, transaction);
    const fields = await getFields(project.id, transaction);
    const configuration = validateFilter(payload, fields);
    const filters = await controller.getDashboardFilters(project.id, { transaction });
    let existing;
    if (payload.filter_id) {
      existing = filters.find((filter) => filter.id === payload.filter_id);
      if (!existing) throw new Error("This filter is not available in the selected dashboard.");
    } else {
      const matches = filters.filter((filter) => filter.configuration.type === "field"
        && filter.configuration.field === configuration.field);
      if (matches.length > 1) throw new Error("Select the filter to update.");
      [existing] = matches;
    }
    if (filters.some((filter) => filter.id !== existing?.id
      && filter.configuration.label?.trim().toLowerCase() === configuration.label.toLowerCase())) {
      throw new Error("Another filter already uses this label. Select that filter or use a different label.");
    }
    const data = { configuration, onReport: payload.on_report ?? existing?.onReport ?? false };
    let filter = existing
      ? await controller.updateDashboardFilter(project.id, existing.id, data, { transaction })
      : await controller.createDashboardFilter(project.id, data, { transaction });
    if (!filter && existing) {
      filter = await controller.getDashboardFilter(project.id, existing.id, { transaction });
    }
    return { project_id: project.id, filter_id: filter.id, filter: serializeFilter(filter) };
  });
}

async function deleteDashboardFilter(payload) {
  return db.sequelize.transaction(async (transaction) => {
    const project = await requireDashboard(payload, true, transaction);
    if (typeof payload.filter_id !== "string" || !payload.filter_id) throw new Error("Select a filter to remove.");
    const removed = await controller.deleteDashboardFilter(project.id, payload.filter_id, { transaction });
    return { project_id: project.id, filter_id: payload.filter_id, removed: Boolean(removed) };
  });
}

module.exports = { listDashboardFilters, setDashboardFilter, deleteDashboardFilter, validateFilter };
