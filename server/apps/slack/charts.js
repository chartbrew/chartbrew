const { getIntegrationContext } = require("../../modules/observations/integrationContext");
const moment = require("moment-timezone");
const db = require("../../models/models");
const ChartController = require("../../controllers/ChartController");
const ChartImageController = require("../../controllers/ChartImageController");
const { loadPreparedSnapshot } = require("../../modules/preparedSnapshot");
const { assertPreparedRows } = require("../../modules/chartImage/imageLimits");
const { getImagePreset, formatLastUpdated } = require("../../modules/chartImage/imageMetadata");
const { canExportChartImage } = require("../../modules/chartImage/imageAccess");
const { getPreview } = require("../../controllers/ChartPreviewController");
const { canEditProject, createHttpError } = require("../../modules/observations/access");
const { nativeChart, section, button, plain } = require("./utils/resultBlocks");

async function requestChartPreview(payload) {
  const context = getIntegrationContext();
  if (!context) throw createHttpError("Chart previews are available in Slack.", 400);
  if (!Number.isSafeInteger(payload.chart_id) || payload.chart_id < 1) throw createHttpError("Select a chart to show.", 400);
  const access = await context.resolveAccess();
  const preview = await loadChart(payload.chart_id, { access, account: { user_id: context.userId } });
  if (payload.allowed_project_ids && !payload.allowed_project_ids.includes(preview.chart.project_id)) {
    throw createHttpError("This chart is not available.", 403);
  }
  return {
    chart_id: preview.chart.id, name: preview.chart.name, type: preview.chart.type,
    project_id: preview.chart.project_id, visibility: preview.parsed.visibility,
    refreshRequested: payload.refresh === true && preview.canQuery,
    guidance: payload.refresh === true && !preview.canQuery
      ? "Show the saved chart. Your account cannot refresh it. Do not describe it as live data."
      : "The chart will be sent in this thread. Refresh is a one-time update, not a live feed. Do not claim newer data before the refresh completes.",
  };
}

async function loadChart(chartId, identity, options = {}) {
  const preview = await getPreview(chartId, identity.account.user_id);
  if (Number(preview.teamId) !== identity.access.teamId) throw createHttpError("Chart unavailable.", 403);
  let chart = preview.chart;
  let preparedData;
  const project = await db.Project.findByPk(chart.project_id, { attributes: ["timezone"] });
  const canQuery = identity.access.canConfigureTeam || canEditProject(identity.access, chart.project_id);
  const role = await db.TeamRole.findOne({ where: { team_id: identity.access.teamId, user_id: identity.account.user_id } });
  const canShare = canExportChartImage(role, chart.project_id);
  if (options.filters && !canQuery) throw createHttpError("You cannot change this chart's period in Slack.", 403);
  if (options.refresh && canQuery) {
    const refreshed = await new ChartController().updateChartData(chart.id, { id: identity.account.user_id }, {
      filters: options.filters || [], runtimeOnly: true, skipSave: true, returnPreparedData: true,
    });
    chart = refreshed.chart;
    preparedData = refreshed.preparedData;
  } else {
    const snapshot = await loadPreparedSnapshot(chart.id);
    if (snapshot?.preparedData && snapshot.preparedData.generatedAt === chart.render?.generatedAt) preparedData = snapshot.preparedData;
  }
  chart = { ...(chart.toJSON ? chart.toJSON() : chart), timezone: project?.timezone || "UTC" };
  return { ...preview, chart, preparedData, filters: options.filters || [], canQuery, canShare };
}

function chartBlocks(preview, reference, options = {}) {
  const { chart, parsed } = preview;
  const timezone = moment.tz.zone(chart.timezone || "") ? chart.timezone : "UTC";
  const blocks = [];
  const native = options.fallback ? null : nativeChart(chart);
  if (native) blocks.push(native);
  else if (preview.fileId) blocks.push({ type: "image", slack_file: { id: preview.fileId }, alt_text: String(chart.name).slice(0, 2000) });
  else blocks.push(section(chart.name || "Chart"));
  const metric = ["avg", "kpi", "gauge"].includes(chart.type) ? chart.render?.metadata?.metrics?.[0] : null;
  if (metric) blocks.push(section(`${metric.label || chart.name}: ${metric.value ?? metric.valueNumber ?? "No value"}`));
  const range = chart.render?.metadata?.timeRange;
  const updated = chart.render?.updatedAt || chart.preparedDataUpdatedAt;
  const details = [range?.start && range?.end ? `${moment(range.start).tz(timezone).format("D MMM YYYY HH:mm")} to ${moment(range.end).subtract(1, "millisecond").tz(timezone).format("D MMM YYYY HH:mm")} (${timezone})` : null,
    updated ? `Data updated: ${moment(updated).tz(timezone).format("D MMM YYYY HH:mm z")}` : "Data update time unavailable"].filter(Boolean);
  blocks.push({ type: "context", elements: [plain(details.join(" · "))] });
  const url = `${process.env.VITE_APP_CLIENT_HOST}/previews/${chart.id}`;
  const elements = [{ type: "button", text: plain("Open in Chartbrew"), url }];
  if (!options.shared) {
    elements.unshift(button("Refresh", "slack_refresh", reference), button("View data", "slack_data", reference));
    if (preview.canQuery && chart.isTimeseries) elements.push(button("Change period", "slack_period", reference));
    if (parsed.visibility === "temporary" && preview.canPlace) elements.push(button("Add to dashboard", "slack_place", reference));
  }
  blocks.push({ type: "actions", elements });
  if (!options.shared && options.canShare && preview.canShare) {
    blocks.push({ type: "actions", elements: [{
      ...button("Share in channel", "slack_share", reference),
      confirm: {
        title: plain("Share this result?"),
        text: plain("Everyone with access to this channel can read this result."),
        confirm: plain("Share"), deny: plain("Cancel"),
      },
    }] });
  }
  return { text: `${chart.name || "Chart"}\n${url}`, blocks };
}

async function addImage(preview, identity, client, channel, assertDeliveryAccess, threadTs) {
  if (preview.fileId || !preview.preparedData) return preview;
  try {
    const imageController = new ChartImageController({
      ...(identity.account.user_id == null ? {
        authorize: async () => {
          await loadChart(preview.chart.id, identity);
          return { chartId: preview.chart.id, projectId: preview.chart.project_id, teamId: identity.access.teamId, userId: null };
        },
      } : {}),
      loadDocument: async (_access, request) => {
        assertPreparedRows(preview.preparedData);
        const preset = getImagePreset(preview.preparedData);
        return { preset, operationalCodes: [], document: {
          ...request, chart: preview.chart, visualization: preview.chart.visualization,
          preparedData: preview.preparedData, renderContext: { timezone: preview.chart.timezone },
          content: { ...request.content, title: { ...request.content.title, text: preview.chart.name } },
          metadata: { dateRange: "", lastUpdated: formatLastUpdated(preview.chart.render?.updatedAt, request.locale, preview.chart.timezone) },
        } };
      },
    });
    const png = await imageController.render({
      params: { chart_id: preview.chart.id, project_id: preview.chart.project_id },
      user: { id: identity.account.user_id }, body: { version: 1 },
    });
    await assertDeliveryAccess();
    const response = await client.files.uploadV2({
      channel_id: channel, thread_ts: threadTs || undefined, file: png, filename: "chart.png", title: preview.chart.name,
    });
    const fileId = response.files?.[0]?.files?.[0]?.id || response.files?.[0]?.id;
    return { ...preview, fileId: fileId || null };
  } catch (_) {
    return preview;
  }
}

async function editableDashboards(identity) {
  const projects = await db.Project.findAll({ where: { team_id: identity.access.teamId, ghost: false }, order: [["name", "ASC"]] });
  return projects.filter((project) => canEditProject(identity.access, project.id));
}

module.exports = { requestChartPreview, addImage, chartBlocks, editableDashboards, loadChart };
