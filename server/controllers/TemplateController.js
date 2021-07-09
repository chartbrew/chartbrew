const db = require("../models/models");

module.exports.findById = (id) => {
  return db.Template.findByPk(id);
};

module.exports.update = (id, data) => {
  return db.Template.update(data, { where: { id } })
    .then(() => this.findById(id));
};

module.exports.create = (data) => {
  return db.Template.create(data)
    .then((template) => this.findById(template.id));
};
