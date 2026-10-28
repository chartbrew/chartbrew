const PRIVATUS_ANALYTICS_HOST = "https://privatusanalytics.com";
const SITE_ID_PATTERN = /^pa_[A-Za-z0-9]+$/;
const TEST_ROUTE = "/stats/aggregate.json?period=today";

function getSiteHost(siteId) {
  if (!SITE_ID_PATTERN.test(siteId || "")) {
    throw new Error("Invalid Privatus Analytics site ID");
  }

  return `${PRIVATUS_ANALYTICS_HOST}/sites/${siteId}`;
}

function getSiteIdFromHost(host) {
  const prefix = `${PRIVATUS_ANALYTICS_HOST}/sites/`;
  if (typeof host !== "string" || !host.startsWith(prefix)) {
    return null;
  }

  const siteId = host.slice(prefix.length).replace(/\/$/, "");
  return SITE_ID_PATTERN.test(siteId) ? siteId : null;
}

function getTestConnection(connection) {
  const host = typeof connection.getApiUrl === "function"
    ? connection.getApiUrl(connection)
    : connection.host;
  const siteId = getSiteIdFromHost(host);
  if (!siteId) {
    throw new Error("Invalid Privatus Analytics site ID");
  }

  const testConnectionData = {
    type: connection.type,
    subType: connection.subType,
    host: `${getSiteHost(siteId)}${TEST_ROUTE}`,
    options: connection.options,
    authentication: connection.authentication,
  };

  if (typeof connection.getHeaders === "function") {
    testConnectionData.getHeaders = () => connection.getHeaders(connection);
  }

  return testConnectionData;
}

module.exports = {
  PRIVATUS_ANALYTICS_HOST,
  SITE_ID_PATTERN,
  getSiteHost,
  getSiteIdFromHost,
  getTestConnection,
};
