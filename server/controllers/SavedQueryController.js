const SavedQuery = require("../models/SavedQuery");
const User = require("../models/User");

class SavedQueryController {
  constructor() {
    this.savedQuery = SavedQuery;
  }

  findById(id) {
    return this.savedQuery.findOne({
      where: { id },
      include: [{ model: User }],
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
    return this.savedQuery.findAll({
      where: { project_id: projectId, type },
      include: [{ model: User }],
    })
      .then((savedQueries) => {
        return savedQueries;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  create(data) {
    return this.savedQuery.create(data)
      .then((savedQuery) => {
        return this.findById(savedQuery.id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  update(id, data) {
    if (!id) {
      return this.savedQuery.create(data)
        .then((savedQuery) => {
          return this.findById(savedQuery.id);
        })
        .catch((error) => {
          return new Promise((resolve, reject) => reject(error));
        });
    }

    return this.savedQuery.update(data, { where: { id } })
      .then(() => {
        return this.findById(id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  remove(id) {
    return this.savedQuery.destroy({ where: { id } })
      .then(() => {
        return true;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }
}

module.exports = SavedQueryController;
