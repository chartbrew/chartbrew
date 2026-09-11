const db = require("../models/models");
const { appendCharts, getReportOrder, breakpoints, validateLayout, getLayouts } = require("../../shared/dashboard/layout.mjs");

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

async function lockDashboard(projectId, transaction) {
  const project = await db.Project.findByPk(projectId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!project) throw fail("Dashboard not found.", 404);
  const charts = await db.Chart.findAll({ where: { project_id: project.id }, transaction, lock: transaction.LOCK.UPDATE, order: [["id", "ASC"]] });
  return { project, charts };
}

async function saveMetadata(project, charts, transaction, extra = {}) {
  await project.update({
    layoutOrder: getReportOrder(charts, project.layoutOrder),
    layoutRevision: (project.layoutRevision || 0) + 1,
    ...extra,
  }, { transaction });
}

async function createPlacedChart(data, options = {}) {
  if (!options.transaction) {
    return db.sequelize.transaction((transaction) => createPlacedChart(data, { ...options, transaction }));
  }
  const { transaction, preserveLayout = false } = options;
  const { project, charts } = await lockDashboard(data.project_id, transaction);
  const layout = preserveLayout && data.layout ? data.layout : appendCharts(charts, [{ ...data, id: "new" }], project.layoutCustom || breakpoints).new;
  const chart = await db.Chart.create({ ...data, layout, dashboardOrder: null }, { transaction });
  const order = getReportOrder(charts, project.layoutOrder);
  const visual = getReportOrder([...charts, chart]);
  const next = preserveLayout ? visual[visual.indexOf(String(chart.id)) + 1] : null;
  const index = next ? order.indexOf(next) : order.length;
  order.splice(index, 0, String(chart.id));
  await saveMetadata(project, [...charts, chart], transaction, {
    layoutOrder: order,
  });
  return chart;
}

async function removePlacedChart(id) {
  const chart = await db.Chart.findByPk(id);
  if (!chart) return 0;
  return db.sequelize.transaction(async (transaction) => {
    const { project, charts } = await lockDashboard(chart.project_id, transaction);
    const result = await db.Chart.destroy({ where: { id, project_id: project.id }, transaction });
    await saveMetadata(project, charts.filter((item) => String(item.id) !== String(id)), transaction);
    return result;
  });
}

async function saveDashboardLayout(projectId, data) {
  if (!data || typeof data !== "object") throw fail("Invalid dashboard layout.");
  return db.sequelize.transaction(async (transaction) => {
    const { project, charts } = await lockDashboard(projectId, transaction);
    if (!Number.isInteger(data.revision) || data.revision !== project.layoutRevision) {
      throw fail("This dashboard changed while you were editing. Reload the layout and try again.", 409);
    }
    const staged = data.staged || [];
    if (!Array.isArray(staged) || staged.some((item) => !item || item.type !== "markdown" || typeof item.id !== "string" || typeof item.content !== "string")) {
      throw fail("Invalid text widgets.");
    }
    const allCharts = [...charts, ...staged];
    const ids = allCharts.map((chart) => String(chart.id));
    if (new Set(ids).size !== ids.length || !Array.isArray(data.order)
      || data.order.length !== ids.length || new Set(data.order.map(String)).size !== ids.length
      || data.order.some((id) => !ids.includes(String(id)))) throw fail("The dashboard widgets changed. Reload the layout and try again.");
    const custom = data.custom || project.layoutCustom || breakpoints;
    if (!Array.isArray(custom) || custom.some((bp) => !breakpoints.includes(bp))) throw fail("Invalid screen size.");
    if (!data.layouts || !Array.isArray(data.layouts.lg)) throw fail("Invalid dashboard layout.");
    const layouts = data.layouts;
    const previous = getLayouts(charts);
    breakpoints.forEach((bp) => {
      validateLayout(layouts[bp], bp, previous[bp]);
      if (layouts[bp].length !== ids.length || layouts[bp].some((item) => !ids.includes(String(item.i)))) {
        throw fail("Each screen layout must contain every widget.");
      }
    });
    const idMap = new Map();
    await Promise.all(staged.map(async (item) => {
      const created = await db.Chart.create({
        project_id: project.id, type: "markdown", name: item.name || "Text",
        content: item.content || "", draft: false, onReport: true,
      }, { transaction });
      idMap.set(item.id, String(created.id));
    }));
    const order = data.order.map((id) => idMap.get(String(id)) || String(id));
    await Promise.all(ids.map(async (id) => {
      const layout = Object.fromEntries(breakpoints.map((bp) => {
        const item = layouts[bp].find((entry) => String(entry.i) === id);
        return [bp, [item.x, item.y, item.w, item.h]];
      }));
      await db.Chart.update({ layout }, { where: { id: idMap.get(id) || id, project_id: project.id }, transaction });
    }));
    await saveMetadata(project, charts, transaction, { layoutOrder: order, layoutCustom: custom });
    return project.id;
  });
}

module.exports = { lockDashboard, saveMetadata, createPlacedChart, removePlacedChart, saveDashboardLayout };
