const Sequelize = require("sequelize");
const net = require("net");
const { databaseHostname, resolveDatabaseTarget, databasePort } = require("../databaseTarget");
const fs = require("fs");
const { createTunnel } = require("tunnel-ssh");
const encodeDatabaseUrlPassword = require("../../../modules/encodeDatabaseUrlPassword");
const { decryptFileSync } = require("../../../modules/fileEncryption");

class DatabaseSocket extends net.Socket {
  constructor(target) {
    super();
    this.target = target;
  }

  connect() {
    return super.connect(this.target);
  }
}

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
    console.error("SSH tunnel error:", error); // oxlint-disable-line no-console
    throw error;
  }
};

module.exports = async (connection) => {
  const dialect = connection.type;
  if (!["postgres", "mysql"].includes(dialect)) throw new Error("Unsupported database type.");

  let { dbName, username, password, host, port } = connection;
  let params = new URLSearchParams();
  if (connection.connectionString) {
    let url;
    try {
      url = new URL(encodeDatabaseUrlPassword(connection.connectionString));
    } catch {
      throw new Error("Enter a valid database connection URL.");
    }
    if (url.protocol.replace("postgresql:", "postgres:") !== `${dialect}:`) {
      throw new Error("The connection URL must match the database type.");
    }
    params = url.searchParams;
    for (const key of params.keys()) {
      if (!["search_path", "ssl", "sslmode", "application_name", "connect_timeout"].includes(key)) {
        throw new Error("Unsupported database connection URL option.");
      }
    }
    host = url.hostname;
    port = url.port || port;
    dbName = decodeURIComponent(url.pathname.slice(1));
    username = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  }

  host = databaseHostname(host || "localhost");
  port = databasePort(port, dialect === "postgres" ? 5432 : 3306);
  const address = await resolveDatabaseTarget(host);
  let socketTarget = { host: address, port };
  let sshTunnel;
  const dialectOptions = {};
  const connectionConfig = { host, port, dialect, dialectOptions, logging: false };

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

  if (params.has("ssl") && !connection.ssl) {
    const ssl = params.get("ssl");
    if (["1", "true"].includes(ssl)) sslOptions = { rejectUnauthorized: true };
    else if (ssl === "no-verify") sslOptions = { rejectUnauthorized: false };
    else if (!["0", "false"].includes(ssl)) throw new Error("Unsupported database SSL setting.");
  }
  const sslMode = params.get("sslmode");
  if (sslMode && !connection.ssl) {
    if (["require", "no-verify"].includes(sslMode)) {
      sslOptions = { rejectUnauthorized: false };
    } else if (["prefer", "verify-full", "verify-ca"].includes(sslMode)) {
      sslOptions = { rejectUnauthorized: true };
    } else if (sslMode !== "disable") {
      throw new Error("Unsupported database SSL mode.");
    }
  }
  if (sslOptions) dialectOptions.ssl = sslOptions;
  if (params.has("application_name")) dialectOptions.application_name = params.get("application_name");
  if (params.has("connect_timeout")) dialectOptions.connectionTimeoutMillis = Number(params.get("connect_timeout")) * 1000;

  if (dialect === "postgres" && params.has("search_path")) {
    connectionConfig.hooks = {
      afterConnect: (client) => client.query("SELECT pg_catalog.set_config('search_path', $1, false)", [params.get("search_path")]),
    };
  }

  if (connection.useSsh) {
    sshTunnel = await createSshTunnel({
      host: await resolveDatabaseTarget(connection.sshHost),
      port: databasePort(connection.sshPort, 22),
      username: connection.sshUsername,
      password: connection.sshPassword,
      privateKey: connection.sshPrivateKey,
      passphrase: connection.sshPassphrase,
    }, socketTarget);
    socketTarget = { host: "127.0.0.1", port: sshTunnel.port };
  }

  // Keep the original host for TLS. Each pooled socket uses the approved address.
  dialectOptions.stream = dialect === "mysql"
    ? () => net.createConnection(socketTarget)
    : () => new DatabaseSocket(socketTarget);

  try {
    const sequelize = new Sequelize(dbName, username || "", password || "", connectionConfig);
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
