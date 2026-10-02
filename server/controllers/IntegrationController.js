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
      const { allowAllChannels = false, allowedChannels = [] } = data.config;
      if (typeof allowAllChannels !== "boolean"
        || !Array.isArray(allowedChannels)
        || allowedChannels.some((channel) => typeof channel !== "string")) {
        throw new Error("Invalid channel settings");
      }
      updates.config = { ...integration.config, allowAllChannels, allowedChannels };
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
