const Sequelize = require("sequelize");
const fs = require("fs");
const { createTunnel } = require("tunnel-ssh");
const { decryptFileSync } = require("./fileEncryption");

// Create SSH tunnel function
const createSshTunnel = async (sshConfig, dbConfig) => {
  const tunnelOptions = {
    autoClose: true,
    keepAlive: true,
    debug: true
  };

  const serverOptions = {
    host: "127.0.0.1",
    port: 0 // Let OS assign a local port dynamically
  };

  const sshOptions = {
    host: sshConfig.host,
    port: sshConfig.port || 22,
    username: sshConfig.username
  };

  if (sshConfig.privateKey) {
    try {
      sshOptions.privateKey = decryptFileSync(sshConfig.privateKey);
      if (sshConfig.passphrase) {
        sshOptions.passphrase = sshConfig.passphrase;
      }
    } catch (error) {
      // If decryption fails, try reading the file directly (for backward compatibility)
      sshOptions.privateKey = fs.readFileSync(sshConfig.privateKey);
    }
  } else if (sshConfig.password) {
    sshOptions.password = sshConfig.password;
  }

  const forwardOptions = {
    dstAddr: dbConfig.host, // Remote DB host
    dstPort: dbConfig.port, // Remote DB port (from user settings)
    srcAddr: "127.0.0.1", // Local forwarded address
    srcPort: 0 // OS will assign a free port dynamically
  };

  try {
    const [server] = await createTunnel(
      tunnelOptions,
      serverOptions,
      sshOptions,
      forwardOptions
    );

    server.on("error", (err) => {
      throw err;
    });

    const assignedPort = server.address().port;

    return {
      server,
      port: assignedPort // The port we must use in Sequelize
    };
  } catch (error) {
    console.error("SSH tunnel error:", error); // eslint-disable-line no-console
    throw error;
  }
};

module.exports = async (connection) => {
  const name = connection.dbName;
  const username = connection.username || "";
  const password = connection.password || "";
  const host = connection.host || "localhost";
  const { port, connectionString } = connection;
  const dialect = connection.type;

  let sequelize;
  let sshTunnel = null;

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
          ca: connection.sslCa ? decryptFileSync(connection.sslCa) : undefined,
        };
        break;

      case "verify-full":
        sslOptions = {
          require: true,
          rejectUnauthorized: true,
          ca: connection.sslCa ? decryptFileSync(connection.sslCa) : undefined,
          key: connection.sslKey ? decryptFileSync(connection.sslKey) : undefined,
          cert: connection.sslCert ? decryptFileSync(connection.sslCert) : undefined,
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

  // Setup SSH tunnel if enabled
  if (connection.useSsh) {
    try {
      const sshConfig = {
        host: connection.sshHost,
        port: parseInt(connection.sshPort, 10) || 22,
        username: connection.sshUsername,
        password: connection.sshPassword,
        privateKey: connection.sshPrivateKey,
        passphrase: connection.sshPassphrase,
        jumpHost: connection.sshJumpHost,
        jumpPort: connection.sshJumpPort
      };

      const dbConfig = {
        host,
        port
      };

      // Create SSH tunnel
      sshTunnel = await createSshTunnel(sshConfig, dbConfig);
    } catch (error) {
      console.error("Failed to establish SSH tunnel:", error); // eslint-disable-line no-console
      throw new Error(`SSH tunnel error: ${error.message}`);
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

  try {
    await sequelize.authenticate();

    // Add the SSH tunnel to the sequelize instance so we can close it later
    if (sshTunnel) {
      sequelize.sshTunnel = sshTunnel.server;
    }

    return sequelize;
  } catch (err) {
    // Close SSH tunnel if it exists
    if (sshTunnel && sshTunnel.server) {
      sshTunnel.server.close();
    }
    throw err;
  }
};
