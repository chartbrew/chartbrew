const net = require("net");

const { validateOutboundHostname } = require("../../modules/outboundTargetPolicy");

function databaseHostname(host) {
  const hostname = typeof host === "string" ? host.replace(/^\[([^\]]+)\]$/, "$1") : "";
  if (!hostname || (!net.isIP(hostname) && !/^[a-z\d._-]+$/i.test(hostname)) || hostname.includes("%")) {
    throw new Error("Enter a valid database hostname or IP address.");
  }

  return hostname;
}

async function resolveDatabaseTarget(host) {
  const hostname = databaseHostname(host);
  const { resolvedAddresses } = await validateOutboundHostname(hostname, { source: "database" }, hostname);
  if (!resolvedAddresses.length) throw new Error("Could not resolve the database hostname.");
  return resolvedAddresses[0];
}

function databasePort(value, fallback) {
  const port = Number(value || fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Enter a valid port.");
  return port;
}

module.exports = { databaseHostname, resolveDatabaseTarget, databasePort };
