const Sequelize = require("sequelize");

module.exports = (connection) => {
  const name = connection.dbName;
  const username = connection.username || "";
  const password = connection.password || "";
  const host = connection.host || "localhost";
  const { port, connectionString } = connection;
  const dialect = connection.type;

  let sequelize;

  if (connectionString) {
    sequelize = new Sequelize(connectionString, {
      host,
      port,
      dialect,
      logging: false,
    });
  } else {
    sequelize = new Sequelize(name, username, password, {
      host,
      port,
      dialect,
      logging: false,
    });
  }

  return sequelize
    .authenticate()
    .then(() => {
      return new Promise((resolve) => resolve(sequelize));
    })
    .catch((err) => {
      return new Promise((resolve, reject) => reject(err));
    });
};
