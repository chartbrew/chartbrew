const fs = require("fs");
const path = require("path");
const { Sequelize, DataTypes } = require("sequelize");
const Umzug = require("umzug");

const basename = path.basename(__filename);
const config = process.env.NODE_ENV === "production"
  ? require("../config/config.js").production : require("../config/config.js").development;
const packageJson = require("../../package.json");

const db = {};

const options = {
  host: config.host,
  port: config.port,
  dialect: config.dialect,
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
};

if (config.cert) {
  options.dialectOptions.ssl = {
    ca: Buffer.from(config.cert, "base64").toString("ascii")
  };
}

const sequelize = new Sequelize(config.database, config.username, config.password, options);

fs
  .readdirSync(__dirname)
  .filter((file) => {
    return (file.indexOf(".") !== 0) && (file !== basename) && (file.slice(-3) === ".js");
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, DataTypes); // eslint-disable-line
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;

const umzug = new Umzug({
  migrations: {
    // indicates the folder containing the migration .js files
    path: path.join(__dirname, "../migrations"),
    // inject sequelize's QueryInterface in the migrations
    params: [
      sequelize.getQueryInterface()
    ]
  },
  storage: "sequelize",
  storageOptions: {
    sequelize,
  }
});

db.migrate = () => umzug.up();
db.migrate()
  .then(async (data) => {
    if (data && data.length > 0) {
      console.info("Updated database schema to the latest version!"); // eslint-disable-line
    }

    // create an instance ID and record the current version
    try {
      const appData = await db.App.findAll();
      if (!appData || appData.length === 0) {
        db.App.create({ version: packageJson.version });
      } else if (appData && appData[0]) {
        db.App.update({ version: packageJson.version }, { where: { id: appData[0].id } });
      }
    } catch (e) {
      // continue
    }
  })
  .catch((err) => console.error(err)); // eslint-disable-line

module.exports = db;
