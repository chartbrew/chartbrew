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

function update(id, data, teamId) {
  const whereCondition = teamId
    ? { id, team_id: teamId }
    : { id };

  return db.Integration.update(data, { where: whereCondition })
    .then(([affectedRows]) => {
      if (affectedRows === 0) {
        return Promise.reject(new Error(404));
      }
      return findById(id, teamId);
    });
}

function create(data) {
  return db.Integration.create(data);
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
};
