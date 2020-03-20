const db = require("../models/models");

class SavedQueryController {
  findAll(conditions = { attributes: { exclude: ["query"] } }) {
    return db.SavedQuery.findAll(conditions)
      .then((savedQueries) => {
        return Promise.resolve(savedQueries);
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  findById(id) {
    return db.SavedQuery.findOne({
      where: { id },
      include: [{ model: db.User }],
    })
      .then((savedQuery) => {
        if (!savedQuery) {
          return new Promise((resolve, reject) => reject(new Error(404)));
        }
        return savedQuery;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findByProject(projectId, type) {
    return db.SavedQuery.findAll({
      where: { project_id: projectId, type },
      include: [{ model: db.User }],
    })
      .then((savedQueries) => {
        return savedQueries;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  create(data) {
    return db.SavedQuery.create(data)
      .then((savedQuery) => {
        return this.findById(savedQuery.id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  update(id, data) {
    if (!id) {
      return db.SavedQuery.create(data)
        .then((savedQuery) => {
          return this.findById(savedQuery.id);
        })
        .catch((error) => {
          return new Promise((resolve, reject) => reject(error));
        });
    }

    return db.SavedQuery.update(data, { where: { id } })
      .then(() => {
        return this.findById(id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  remove(id) {
    return db.SavedQuery.destroy({ where: { id } })
      .then(() => {
        return true;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }
}

module.exports = SavedQueryController;
