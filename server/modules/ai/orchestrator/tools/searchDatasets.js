const { searchDatasetProfiles } = require("../../../datasetIntelligence/searchDatasetProfiles");

async function searchDatasets(payload) {
  const {
    team_id: teamId,
    query,
    project_id: projectId,
    allowed_project_ids: allowedProjectIds,
    limit,
  } = payload;

  return searchDatasetProfiles({
    teamId: Number(teamId),
    query,
    projectId,
    allowedProjectIds,
    limit,
  });
}

module.exports = searchDatasets;
