const http = require("http");
const https = require("https");
const net = require("net");
const createPinnedLookup = require("../../../modules/createPinnedLookup");
const { databaseHostname, databasePort, resolveDatabaseTarget } = require("../../shared/databaseTarget");
const { createClient } = require("@clickhouse/client");
const { decryptFileSync } = require("../../../modules/fileEncryption");

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

  const target = databaseHostname(host);
  const hostname = net.isIPv6(target) ? `[${target}]` : target;
  const url = new URL(`http${ssl ? "s" : ""}://${hostname}:${databasePort(port, ssl ? 8443 : 8123)}`);
  const canonicalHost = url.hostname.replace(/^\[|\]$/g, "");
  const address = await resolveDatabaseTarget(canonicalHost);
  const agentOptions = { keepAlive: true, lookup: createPinnedLookup(canonicalHost, [address]) };

  const config = {
    url: url.href,
    username,
    password,
    database: dbName,
    clickhouse_settings: {
      max_execution_time: 30000, // 30 seconds timeout
    }
  };

  // SSL configuration if enabled
  if (ssl && (sslMode === "verify-full" || sslMode === "verify-ca")) {
    Object.assign(agentOptions, {
      rejectUnauthorized: sslMode === "verify-full" || sslMode === "verify-ca",
      ca: sslCa ? decryptFileSync(sslCa) : undefined,
      cert: sslCert ? decryptFileSync(sslCert) : undefined,
      key: sslKey ? decryptFileSync(sslKey) : undefined
    });
  }
  config.http_agent = ssl ? new https.Agent(agentOptions) : new http.Agent(agentOptions);

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
