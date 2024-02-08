const Sequelize = require("sequelize");
const fs = require("fs");

module.exports = (connection) => {
  const name = connection.dbName;
  const username = connection.username || "";
  const password = connection.password || "";
  const host = connection.host || "localhost";
  const { port, connectionString } = connection;
  const dialect = connection.type;

  let sequelize;

  const connectionConfig = {
    host,
    port,
    dialect,
    logging: false,
  };

  let sslOptions = null;

  if (connection.subType === "timescaledb") {
    sslOptions = {
      require: true,
      rejectUnauthorized: false,
    };
  }

  if (connection.ssl) {
    switch (connection.sslMode) {
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
          ca: connection.sslCa ? fs.readFileSync(connection.sslCa) : undefined,
        };
        break;

      case "verify-full":
        sslOptions = {
          require: true,
          rejectUnauthorized: true,
          ca: connection.sslCa ? fs.readFileSync(connection.sslCa) : undefined,
          key: connection.sslKey ? fs.readFileSync(connection.sslKey) : undefined,
          cert: connection.sslCert ? fs.readFileSync(connection.sslCert) : undefined,
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
  }

  if (connectionString) {
    // extract each element from the string so that we can encode the password
    // this is needed when the password contains symbols that are not URI-friendly
    const cs = connectionString;
    let newConnectionString = "";

    const protocol = cs.substring(0, cs.indexOf("//") + 2);
    newConnectionString = cs.replace(protocol, "");

    const username = newConnectionString.substring(0, newConnectionString.indexOf(":"));
    newConnectionString = cs.replace(protocol + username, "");

    const password = encodeURIComponent(newConnectionString.substring(1, newConnectionString.lastIndexOf("@")));

    const hostAndOpt = cs.substring(cs.lastIndexOf("@"));

    newConnectionString = `${protocol}${username}:${password}${hostAndOpt}`;

    connectionConfig.dialectOptions = {
      ssl: sslOptions,
    };

    // check if a postgres connection needs SSL
    if (newConnectionString.indexOf("sslmode=require") > -1 && dialect === "postgres" && !connection.ssl) {
      newConnectionString = newConnectionString.replace("?sslmode=require", "");
      newConnectionString = newConnectionString.replace("&sslmode=require", "");
      connectionConfig.dialectOptions = {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      };
    }

    sequelize = new Sequelize(newConnectionString, connectionConfig);
  // else just connect with each field from the form
  } else {
    if (sslOptions) {
      connectionConfig.dialectOptions = {
        ssl: sslOptions,
      };
    }
    sequelize = new Sequelize(name, username, password, connectionConfig);
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
