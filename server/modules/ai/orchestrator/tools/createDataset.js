const DatasetController = require("../../../../controllers/DatasetController");
const { requireSupportedSourceForConnection } = require("../sourceSupport");
const { repairSourceDatasetIntentAsync } = require("./sourceIntentRepair");
const { normalizeTeamId, requireConnectionForTeam, requireProjectForTeam } = require("./teamScope");

const datasetController = new DatasetController();

const clientUrl = process.env.NODE_ENV === "production" ? process.env.VITE_APP_CLIENT_HOST : process.env.VITE_APP_CLIENT_HOST_DEV;

async function createDataset(payload) {
  let {
    project_id, connection_id, name, team_id,
    query, method, route, itemsLimit, conditions = [], configuration = {}, variables = [], transform = null,
    variableBindings = []
  } = payload;

  if (!team_id) {
    throw new Error("team_id is required to create a dataset");
  }

  const normalizedTeamId = normalizeTeamId(team_id);

  try {
    // Check if the project is a ghost project - ghost projects should not be in project_ids
    let projectIds = [];
    if (project_id) {
      const project = await requireProjectForTeam(project_id, normalizedTeamId);
      if (project && !project.ghost) {
        projectIds = [project_id];
      }
    }

    const connection = await requireConnectionForTeam(connection_id, normalizedTeamId);
    const source = requireSupportedSourceForConnection(connection);

    const repairedPayload = await repairSourceDatasetIntentAsync(source, {
      name,
      question: payload.question,
      original_question: payload.original_question,
      query,
      method,
      route,
      itemsLimit,
      conditions,
      configuration,
      connection,
      spec: payload.spec,
    });
    query = repairedPayload.query ?? query;
    configuration = repairedPayload.configuration;
    method = repairedPayload.method ?? method;
    route = repairedPayload.route ?? route;
    itemsLimit = repairedPayload.itemsLimit ?? itemsLimit;
    conditions = repairedPayload.conditions ?? conditions;

    // Use the quick-create function to create dataset with data request in one go
    const dataset = await datasetController.createWithDataRequests({
      team_id: normalizedTeamId,
      project_ids: projectIds,
      draft: false,
      name: name || "AI Generated Dataset",
      variableBindings,
      dataRequests: [{
        connection_id,
        method,
        route,
        itemsLimit,
        query,
        conditions,
        configuration: configuration || {},
        variables: variables || [],
        transform: transform || null
      }],
      main_dr_index: 0
    });

    // Extract data request ID from the returned dataset
    const dataRequestId = dataset.DataRequests && dataset.DataRequests.length > 0
      ? dataset.DataRequests[0].id
      : dataset.main_dr_id;

    return {
      dataset_id: dataset.id,
      data_request_id: dataRequestId,
      name: dataset.name || dataset.legend,
      dataset_url: `${clientUrl}/datasets/${dataset.id}`,
      intent_repair: repairedPayload.intentRepair,
    };
  } catch (error) {
    throw new Error(`Dataset creation failed: ${error.message}`);
  }
}

module.exports = createDataset;
