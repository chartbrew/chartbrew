const runtimeCache = require("./runtimeCache");
const db = require("../models/models");
const { viewerRoles } = require("../../shared/roles.json");

async function loadDashboardChartBatch(projectId, requests, user, chartController, { publicProject, resolveVariables, viewerScope } = {}) {
  if (!Array.isArray(requests) || requests.length < 1 || requests.length > 4
    || requests.some((item) => !Number.isSafeInteger(item?.chart_id) || item.chart_id < 1
      || !Array.isArray(item.filters) || item.filters.length > 100
      || item.filters.some((filter) => !filter || typeof filter !== "object" || Array.isArray(filter))
      || !item.variables || typeof item.variables !== "object" || Array.isArray(item.variables)
      || Object.keys(item.variables).length > 100)
    || new Set(requests.map((item) => item.chart_id)).size !== requests.length) {
    throw Object.assign(new Error("Select between one and four charts with valid filters."), { status: 400 });
  }

  const visibility = publicProject ? { onReport: true, draft: false } : {};
  if (!publicProject && viewerRoles.includes(user.teamRole.role)) visibility.draft = false;
  const charts = await db.Chart.findAll({
    attributes: ["id"],
    where: {
      id: requests.map((item) => item.chart_id),
      project_id: projectId,
      ...visibility,
    },
  });
  if (charts.length !== requests.length) {
    throw Object.assign(new Error("Chart not found."), { status: 404 });
  }

  return Promise.all(requests.map(async ({ chart_id, filters, variables: requestedVariables }) => {
    try {
      const variables = resolveVariables ? resolveVariables(requestedVariables) : requestedVariables;
      const hasFilters = filters.length > 0 || Object.keys(variables).length > 0;
      let chart = hasFilters
        ? await chartController.updateChartData(chart_id, user, {
          filters, variables, noSource: true, getCache: true, runtimeOnly: true,
          ...(viewerScope ? { viewerScope } : {}),
        })
        : await chartController.findById(chart_id, null, { refreshPreparedData: false });
      if (!hasFilters && !chart?.render && chart?.ChartDatasetConfigs?.length) {
        chart = await runtimeCache.runSingleFlight(`prepared-snapshot-refresh:${chart_id}`, () => chartController.updateChartData(chart_id, user, {
          noSource: false, getCache: true,
        }));
      }
      if (publicProject) {
        const configuration = publicProject.Charts.find((item) => item.id === chart_id);
        if (!configuration) throw new Error("Chart not found");
        const result = configuration.toJSON();
        for (const field of ["render", "dateFormat", "isTimeseries", "preparedDataUpdatedAt", "stale"]) {
          result[field] = chart[field];
        }
        result.showBranding = publicProject.Team?.showBranding;
        return { id: chart_id, chart: result };
      }
      return { id: chart_id, chart };
    } catch (error) {
      return { id: chart_id, error: "Could not load this chart. Try again." };
    }
  }));
}

module.exports = { loadDashboardChartBatch };
