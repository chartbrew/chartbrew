const db = require("../../../../models/models");
const DatasetController = require("../../../../controllers/DatasetController");

const datasetController = new DatasetController();

const clientUrl = process.env.NODE_ENV === "production" ? process.env.VITE_APP_CLIENT_HOST : process.env.VITE_APP_CLIENT_HOST_DEV;

async function createDataset(payload) {
  const {
    project_id, connection_id, name, team_id,
    xAxis, yAxis, yAxisOperation = "none", dateField, dateFormat,
    query, conditions = [], configuration = {}, variables = [], transform = null,
    variableBindings = []
  } = payload;

  if (!team_id) {
    throw new Error("team_id is required to create a dataset");
  }

  try {
    // Check if the project is a ghost project - ghost projects should not be in project_ids
    let projectIds = [];
    if (project_id) {
      const project = await db.Project.findByPk(project_id);
      if (project && !project.ghost) {
        projectIds = [project_id];
      }
    }

    // Use the quick-create function to create dataset with data request in one go
    const dataset = await datasetController.createWithDataRequests({
      team_id,
      project_ids: projectIds,
      draft: false,
      legend: name || "AI Generated Dataset",
      xAxis,
      yAxis,
      yAxisOperation,
      dateField,
      dateFormat,
      conditions,
      variableBindings,
      dataRequests: [{
        connection_id,
        query,
        conditions: conditions || [],
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
      name: dataset.legend,
      dataset_url: `${clientUrl}/datasets/${dataset.id}`,
    };
  } catch (error) {
    throw new Error(`Dataset creation failed: ${error.message}`);
  }
}

module.exports = createDataset;
