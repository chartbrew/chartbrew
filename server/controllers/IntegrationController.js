const db = require("../models/models");

function findById(id) {
  return db.Integration.findByPk(id);
}

function findByTeam(teamId) {
  return db.Integration.findAll({
    where: {
      team_id: teamId,
    },
  });
}

function update(id, data) {
  return db.Integration.update(data, {
    where: {
      id,
    },
  })
    .then(() => findById(id));
}

function create(data) {
  return db.Integration.create(data);
}

function remove(id) {
  return db.Integration.destroy({
    where: {
      id,
    },
  })
    .then(() => {
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
