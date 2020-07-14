const { QueryTypes } = require("sequelize");

const db = require("../models");

module.exports.up = () => {
  return db.sequelize.query("SELECT id, name, surname FROM User", { type: QueryTypes.SELECT })
    .then((users) => {
      if (!users || users.length < 1) return Promise.resolve("done");

      const updatePromises = [];
      users.map((user) => {
        if (user.name && user.surname) {
          const newName = `${user.name} ${user.surname}`;
          updatePromises.push(db.User.update(
            { name: newName },
            { where: { id: user.id } },
          ));
        }
        return user;
      });

      return Promise.all(updatePromises);
    })
    .catch((err) => {
      return err;
    });
};

module.exports.down = () => {
  return db.sequelize.query("SELECT name, surname FROM User", { type: QueryTypes.SELECT })
    .then((users) => {
      if (!users || users.length < 1) return Promise.resolve("done");

      const updatePromises = [];
      users.map((user) => {
        if (user.name && user.name.lastIndexOf(" ") > 0) {
          const surname = user.name.substring(user.name.lastIndexOf(" ") + 1);
          const name = user.name.substring(0, user.name.lastIndexOf(" "));
          updatePromises.push(db.User.update(
            { name, surname },
            { where: { id: user.id } },
          ));
        }
        return user;
      });

      return Promise.all(updatePromises);
    })
    .catch((err) => {
      return err;
    });
};
