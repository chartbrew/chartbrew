const {
  getDatasetIntelligenceRecord,
  profileDataset,
} = require("../../../datasetIntelligence/profileDataset");
const { requireDatasetForTeam } = require("./teamScope");
const {
  recordIntelligenceEvent,
} = require("../../../datasetIntelligence/observability");

async function getDatasetIntelligence(payload) {
  const {
    allowed_project_ids: allowedProjectIds,
    dataset_id: datasetId,
    team_id: teamId,
  } = payload;
  const dataset = await requireDatasetForTeam(datasetId, teamId);
  const projectIds = Array.isArray(dataset.project_ids) ? dataset.project_ids : [];
  if (
    Array.isArray(allowedProjectIds)
    && !projectIds.some((projectId) => allowedProjectIds.includes(Number(projectId)))
  ) {
    throw new Error("Dataset is not available in your projects");
  }
  const current = await getDatasetIntelligenceRecord({
    datasetId: dataset.id,
    teamId: Number(teamId),
  });

  if (["missing", "stale"].includes(current.status)) {
    const generated = await profileDataset({
      datasetId: dataset.id,
      teamId: Number(teamId),
      generationReason: "agent_retrieval",
    });
    recordIntelligenceEvent("agent_profile_retrieved", {
      teamId: Number(teamId),
      selectedDatasetId: dataset.id,
      profileStatus: generated.status,
      status: "completed",
    });
    return generated;
  }

  recordIntelligenceEvent("agent_profile_retrieved", {
    teamId: Number(teamId),
    selectedDatasetId: dataset.id,
    profileStatus: current.status,
    profileAgeSeconds: current.generated_at
      ? Math.max(0, Math.floor((Date.now() - new Date(current.generated_at).getTime()) / 1000))
      : undefined,
    status: "completed",
  });
  return current;
}

module.exports = getDatasetIntelligence;
