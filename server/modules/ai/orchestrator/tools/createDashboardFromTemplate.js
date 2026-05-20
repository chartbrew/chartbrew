const ChartTemplateController = require("../../../../controllers/ChartTemplateController");
const { normalizeTeamId } = require("./teamScope");

const chartTemplateController = new ChartTemplateController();
const clientUrl = process.env.NODE_ENV === "production" ? process.env.VITE_APP_CLIENT_HOST : process.env.VITE_APP_CLIENT_HOST_DEV;

async function createDashboardFromTemplate(payload) {
  const {
    team_id,
    user_id,
    source_id,
    template_slug,
    connection_id,
    dashboard = {},
    dataset_template_ids,
    chart_template_ids,
    variable_defaults,
  } = payload;

  if (!team_id) {
    throw new Error("team_id is required to create a dashboard from a template");
  }
  if (!user_id) {
    throw new Error("user_id is required to create a dashboard from a template");
  }
  if (!source_id) {
    throw new Error("source_id is required to create a dashboard from a template");
  }
  if (!template_slug) {
    throw new Error("template_slug is required to create a dashboard from a template");
  }
  if (!connection_id) {
    throw new Error("connection_id is required to create a dashboard from a template");
  }

  const result = await chartTemplateController.createFromTemplate(
    normalizeTeamId(team_id),
    source_id,
    template_slug,
    {
      connection_id,
      dashboard,
      dataset_template_ids,
      chart_template_ids,
      variable_defaults,
    },
    { id: Number(user_id) },
  );

  return {
    status: "ok",
    dashboard_created: true,
    source: source_id,
    template_slug,
    project_id: result.project_id,
    dashboard_url: `${clientUrl}/dashboard/${result.project_id}`,
    datasets: result.datasets,
    charts: result.charts,
  };
}

module.exports = createDashboardFromTemplate;
