const Sequelize = require("sequelize");

module.exports = (connection) => {
  const name = connection.dbName;
  const username = connection.username || "";
  const password = connection.password || "";
  const host = connection.host || "localhost";
  const { port } = connection;
  const dialect = connection.type;

  const sequelize = new Sequelize(name, username, password, {
    host,
    port,
    dialect,
    logging: false,
  });

  return sequelize
    .authenticate()
    .then(() => {
      return new Promise(resolve => resolve(sequelize));
    })
    .catch((err) => {
      return new Promise((resolve, reject) => reject(err));
    });
};
