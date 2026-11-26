const { randomBytes } = require("crypto");
const { once } = require("events");
const { createServer } = require("@pondwader/socks5-server");
const ConnectionString = require("mongodb-connection-string-url").default;

const { resolveDatabaseTarget } = require("../../shared/databaseTarget");

let proxyOptions;

async function startProxy() {
  const password = randomBytes(32).toString("hex");
  const proxy = createServer({ auth: { username: "mongodb", password } });

  // MongoDB can discover new replica members after it connects to a seed.
  // Check each socket destination and give the proxy only the approved IP.
  proxy.setRulesetValidator(async (connection) => {
    try {
      connection.destAddress = await resolveDatabaseTarget(connection.destAddress);
      return true;
    } catch {
      return false;
    }
  });

  const ready = once(proxy.server, "listening");
  proxy.listen(0, "127.0.0.1");
  await ready;
  proxy.server.unref();
  return {
    proxyHost: "127.0.0.1",
    proxyPort: proxy.server.address().port,
    proxyUsername: "mongodb",
    proxyPassword: password,
  };
}

async function getMongoOutboundOptions(uri) {
  const parsed = new ConnectionString(uri);
  for (const [key, value] of parsed.searchParams) {
    if (/^(proxy|tls(CAFile|CertificateKeyFile)|authMechanismProperties|lookup|socket$|existingSocket|secureContext|autoEncryption)/i.test(key)
      || (key.toLowerCase() === "authmechanism" && !/^(DEFAULT|SCRAM-SHA-1|SCRAM-SHA-256|MONGODB-X509)$/i.test(value))) {
      throw new Error("Unsupported MongoDB connection URL option.");
    }
  }

  if (!parsed.isSRV) {
    await Promise.all(parsed.hosts.map((seed) => resolveDatabaseTarget(new URL(`http://${seed}`).hostname)));
  }

  if (!proxyOptions) {
    proxyOptions = startProxy().catch((error) => {
      proxyOptions = null;
      throw error;
    });
  }
  return proxyOptions;
}

module.exports = getMongoOutboundOptions;
