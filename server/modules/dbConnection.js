const Sequelize = require("sequelize");
const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const name = settings.db.dbName;
const username = settings.db.dbUsername || "root";
const password = settings.db.dbPassword || "";
const host = settings.db.dbHost || "localhost";

const sequelize = new Sequelize(name, username, password, {
  host,
  post: 3306,
  dialect: "mysql",
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    chartset: "utf8mb4",
    collate: "utf8mb4_general_ci",
  },
  dialectOptions: {
    charset: "utf8mb4",
  },
});

sequelize
  .authenticate()
  .then(() => {
    sequelize.sync({ force: false });
  })
  .catch((err) => {
    console.log("Unable to connect to the database:", err); // eslint-disable-line
  });

module.exports = sequelize;
