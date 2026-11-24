const { requireSupportedSourceForConnection, sourceSupportsQueryGeneration } = require("../sourceSupport");
const { requireDatasetForTeam, requireMainDataRequest, requireConnectionForTeam } = require("./teamScope");

async function getDatasetQuery({ dataset_id, team_id }) {
  const dataset = await requireDatasetForTeam(dataset_id, team_id);
  const request = await requireMainDataRequest(dataset);
  const connection = await requireConnectionForTeam(request.connection_id, team_id);
  const source = requireSupportedSourceForConnection(connection);

  if (!sourceSupportsQueryGeneration(source)) {
    throw new Error("This source does not support query editing");
  }
  if (!request.query?.trim()) {
    throw new Error("The dataset has no saved query");
  }

  return {
    dataset_id: dataset.id,
    data_request_id: request.id,
    connection_id: connection.id,
    dialect: source.id,
    query: request.query,
  };
}

module.exports = getDatasetQuery;
