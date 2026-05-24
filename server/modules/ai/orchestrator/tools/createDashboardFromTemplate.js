const ChartTemplateController = require("../../../../controllers/ChartTemplateController");
const {
  requireSupportedSourceForConnection,
} = require("../sourceSupport");
const {
  normalizeTeamId,
  requireConnectionForTeam,
} = require("./teamScope");

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
    original_question,
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

  const normalizedTeamId = normalizeTeamId(team_id);
  const connection = await requireConnectionForTeam(connection_id, normalizedTeamId);
  const source = requireSupportedSourceForConnection(connection);

  if (source.id !== source_id) {
    throw new Error(`Connection does not match source ${source_id}`);
  }

  let resolvedVariableDefaults = variable_defaults || {};
  const prepareTemplateVariables = source.backend?.ai?.prepareTemplateVariables;
  if (typeof prepareTemplateVariables === "function") {
    const prepared = await prepareTemplateVariables({
      connection,
      templateSlug: template_slug,
      question: original_question,
      variableDefaults: resolvedVariableDefaults,
      datasetTemplateIds: dataset_template_ids,
      chartTemplateIds: chart_template_ids,
      dashboard,
    });

    if (prepared?.needs_user_input) {
      return prepared;
    }

    resolvedVariableDefaults = prepared?.variableDefaults || resolvedVariableDefaults;
  }

  const result = await chartTemplateController.createFromTemplate(
    normalizedTeamId,
    source_id,
    template_slug,
    {
      connection_id,
      dashboard,
      dataset_template_ids,
      chart_template_ids,
      variable_defaults: resolvedVariableDefaults,
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
