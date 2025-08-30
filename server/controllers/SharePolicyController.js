const db = require("../models/models");

async function createSharePolicy(data) {
  return db.SharePolicy.create(data);
}

async function updateSharePolicy(id, data) {
  return db.SharePolicy.update(data, { where: { id } });
}

async function findByEntityId(entityId) {
  return db.SharePolicy.findAll({ where: { entity_id: entityId } });
}

async function deleteSharePolicy(id) {
  return db.SharePolicy.destroy({ where: { id } });
}

module.exports = {
  createSharePolicy,
  updateSharePolicy,
  findByEntityId,
  deleteSharePolicy,
};
