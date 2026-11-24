const db = require("../models/models");

function findById(id, teamId) {
  if (teamId) {
    return db.Integration.findOne({
      where: { id, team_id: teamId },
    });
  }

  return db.Integration.findByPk(id);
}

function findByTeam(teamId) {
  return db.Integration.findAll({
    where: {
      team_id: teamId,
    },
  });
}

async function update(id, data, teamId) {
  const integration = await findById(id, teamId);
  if (!integration) throw new Error(404);
  if (data.type !== undefined && data.type !== integration.type) {
    throw new Error("Integration type cannot be changed");
  }

  const updates = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.config !== undefined) {
    if (integration.type === "slack") {
      const { allowAllChannels = false, allowedChannels = [], accessMode = "admins-only", dashboardIds = [], allowAllDashboards = false } = data.config;
      if (typeof allowAllChannels !== "boolean"
        || !Array.isArray(allowedChannels)
        || allowedChannels.some((channel) => typeof channel !== "string")) {
        throw new Error("Invalid channel settings");
      }
      if (typeof allowAllDashboards !== "boolean"
        || !["admins-only", "team", "team-and-clients", "everyone"].includes(accessMode)
        || !Array.isArray(dashboardIds) || dashboardIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
        throw new Error("Choose valid Slack access settings");
      }
      const projects = dashboardIds.length ? await db.Project.findAll({ where: { team_id: integration.team_id, ghost: false }, attributes: ["id"] }) : [];
      if (dashboardIds.some((id) => !projects.some((project) => Number(project.id) === id))) {
        throw new Error("Choose dashboards from this team");
      }
      updates.config = { ...integration.config, allowAllChannels, allowedChannels, accessMode, dashboardIds, allowAllDashboards };
    } else {
      updates.config = { url: data.config.url, slackMode: data.config.slackMode === true };
    }
  }

  return integration.update(updates);
}

async function create(data) {
  if (data.type !== "webhook") {
    throw new Error("Connect Slack through the Slack app");
  }

  return db.Integration.create({
    team_id: data.team_id,
    name: data.name,
    type: "webhook",
    config: { url: data.config?.url, slackMode: data.config?.slackMode === true },
  });
}

function toPublicIntegration(integration) {
  const result = { ...integration.toJSON() };
  if (result.type === "slack") {
    result.config = { ...result.config };
    delete result.config.bot_token;
  }
  return result;
}

function remove(id, teamId) {
  return findById(id, teamId)
    .then((integration) => {
      if (!integration) {
        return Promise.reject(new Error(404));
      }

      const whereCondition = teamId
        ? { id, team_id: teamId }
        : { id };

      return db.Integration.destroy({ where: whereCondition });
    })
    .then((deletedRows) => {
      if (deletedRows === 0) {
        return Promise.reject(new Error(404));
      }

      return db.AlertIntegration.destroy({
        where: {
          integration_id: id,
        },
      });
    });
}

module.exports = {
  findById,
  findByTeam,
  update,
  create,
  remove,
  toPublicIntegration,
};
