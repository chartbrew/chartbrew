const fs = require("fs");
const path = require("path");
const { Sequelize, DataTypes } = require("sequelize");
const { Umzug, SequelizeStorage } = require("umzug");

const basename = path.basename(__filename);
const config = process.env.NODE_ENV === "production"
  ? require("../config/config.js").production : require("../config/config.js").development;

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

if (config.ssl) {
  let sslOptions = null;
  switch (config.ssl) {
    case "require":
      sslOptions = {
        require: true,
        rejectUnauthorized: false,
      };
      break;

    case "verify-ca":
      sslOptions = {
        require: true,
        rejectUnauthorized: true,
        ca: config.cert ? Buffer.from(config.cert, "base64").toString("ascii") : undefined,
      };
      break;

    case "verify-full":
      sslOptions = {
        require: true,
        rejectUnauthorized: true,
        ca: config.cert ? Buffer.from(config.cert, "base64").toString("ascii") : undefined,
        key: config.sslKey ? Buffer.from(config.cert, "base64").toString("ascii") : undefined,
        cert: config.sslCert ? Buffer.from(config.cert, "base64").toString("ascii") : undefined,
      };
      break;
    case "prefer":
      sslOptions = {
        require: false,
        rejectUnauthorized: false,
      };
      break;
    case "disable":
      sslOptions = {
        require: false,
        rejectUnauthorized: false,
      };
      break;
    default:
      sslOptions = {
        require: true,
        rejectUnauthorized: false,
      };
      break;
  }

  options.dialectOptions.ssl = sslOptions;
}

if (config.cert && !config.ssl) {
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
    glob: ["./migrations/*.js", { cwd: path.join(__dirname, "..") }],
    resolve: (params) => {
      // Custom resolver function to require and run migration files
      const migration = require(params.path); // eslint-disable-line
      return { name: params.name, up: async () => migration.up(params.context, Sequelize) };
    },
  },
  context: sequelize.getQueryInterface(), // Passing the QueryInterface as context to migrations
  storage: new SequelizeStorage({ sequelize }), // Using the new SequelizeStorage
  logger: console,
});

db.migrate = () => umzug.up();

module.exports = db;
