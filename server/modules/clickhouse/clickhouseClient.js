const { createClient } = require("@clickhouse/client");
const { decryptFileSync } = require("../fileEncryption");

const createClickHouseClient = async (connection) => {
  const {
    host,
    port,
    username,
    password,
    dbName,
    ssl,
    sslMode,
    sslCa,
    sslCert,
    sslKey
  } = connection;

  // Base configuration
  const config = {
    url: `http${ssl ? "s" : ""}://${host}:${port || (ssl ? 8443 : 8123)}`,
    username,
    password,
    database: dbName,
    clickhouse_settings: {
      max_execution_time: 30000, // 30 seconds timeout
    }
  };

  // SSL configuration if enabled
  if (ssl && (sslMode === "verify-full" || sslMode === "verify-ca")) {
    config.tls = {
      rejectUnauthorized: sslMode === "verify-full" || sslMode === "verify-ca",
      ca: sslCa ? decryptFileSync(sslCa) : undefined,
      cert: sslCert ? decryptFileSync(sslCert) : undefined,
      key: sslKey ? decryptFileSync(sslKey) : undefined
    };
  }

  try {
    const client = createClient(config);

    // Test the connection
    await client.ping();

    return client;
  } catch (error) {
    throw new Error(`ClickHouse connection error: ${error.message}`);
  }
};

module.exports = createClickHouseClient;
