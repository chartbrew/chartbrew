const db = require("../models/models");

const findById = (id) => {
  return db.OAuth.findByPk(id)
    .then((oauth) => {
      return oauth;
    })
    .catch((err) => {
      return Promise.reject(err);
    });
};

const findOne = (condition) => {
  return db.OAuth.findOne({ where: condition })
    .then((oauth) => {
      return oauth;
    })
    .catch((err) => {
      return Promise.reject(err);
    });
};

const create = async (data) => {
  const oauth = await findOne({ team_id: data.team_id, email: data.email });
  if (oauth) {
    if (!data.refreshToken) return oauth;

    return db.OAuth.update(
      { refreshToken: data.refreshToken },
      { where: { id: oauth.id } },
    )
      .then(() => {
        return findById(oauth.id);
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  }

  return db.OAuth.create(data)
    .then((created) => {
      return created;
    })
    .catch((err) => {
      return Promise.reject(err);
    });
};

const update = (id, data) => {
  return db.OAuth.update(data, { where: { id } })
    .then(() => {
      return findById(id);
    })
    .catch((err) => {
      return Promise.reject(err);
    });
};

module.exports = {
  findById,
  findOne,
  create,
  update,
};
