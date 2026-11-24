const db = require("../../../../models/models");

function normalizeTeamId(teamId) {
  const normalizedTeamId = Number(teamId);

  if (!Number.isInteger(normalizedTeamId) || normalizedTeamId <= 0) {
    throw new Error("team_id is required");
  }

  return normalizedTeamId;
}

async function requireProjectForTeam(projectId, teamId) {
  const normalizedTeamId = normalizeTeamId(teamId);
  const project = await db.Project.findByPk(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.team_id !== normalizedTeamId) {
    throw new Error("Project does not belong to the specified team");
  }

  return project;
}

async function requireConnectionForTeam(connectionId, teamId) {
  const normalizedTeamId = normalizeTeamId(teamId);
  const connection = await db.Connection.findByPk(connectionId);

  if (!connection) {
    throw new Error("Connection not found");
  }

  if (connection.team_id !== normalizedTeamId) {
    throw new Error("Connection does not belong to the specified team");
  }

  return connection;
}

async function requireDatasetForTeam(datasetId, teamId) {
  const normalizedTeamId = normalizeTeamId(teamId);
  const dataset = await db.Dataset.findByPk(datasetId);

  if (!dataset) {
    throw new Error("Dataset not found");
  }

  if (dataset.team_id !== normalizedTeamId) {
    throw new Error("Dataset does not belong to the specified team");
  }

  return dataset;
}

async function requireMainDataRequest(dataset) {
  const dataRequest = await db.DataRequest.findOne({
    where: {
      dataset_id: dataset.id,
      ...(dataset.main_dr_id ? { id: dataset.main_dr_id } : {}),
    },
    attributes: ["id", "connection_id", "query"],
    order: [["id", "ASC"]],
  });

  if (!dataRequest) {
    throw new Error("The dataset has no main data request");
  }

  return dataRequest;
}

module.exports = {
  requireMainDataRequest,
  normalizeTeamId,
  requireProjectForTeam,
  requireConnectionForTeam,
  requireDatasetForTeam,
};
