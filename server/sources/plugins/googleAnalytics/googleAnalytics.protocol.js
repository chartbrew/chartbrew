const db = require("../../../models/models");
const oauthController = require("../../../controllers/OAuthController");
const drCacheController = require("../../../controllers/DataRequestCacheController");
const { serializeResponsePreview } = require("../../../modules/updateAudit");
const {
  checkAndGetCache,
  completeConnectorAudit,
  failConnectorAudit,
} = require("../../shared/connectorRuntime");
const googleAnalyticsConnection = require("./googleAnalytics.connection");

async function getSavedConnection(connection) {
  if (!connection?.id) {
    return connection;
  }

  return db.Connection.findByPk(connection.id)
    .then((savedConnection) => savedConnection || connection)
    .catch(() => connection);
}

async function getOAuth(connection) {
  if (!connection.oauth_id) {
    return Promise.reject({ error: "No oauth token" });
  }

  const oauth = await oauthController.findById(connection.oauth_id);
  if (!oauth) {
    return Promise.reject(new Error("OAuth is not registered properly"));
  }

  return oauth;
}

async function testConnection({ connection }) {
  const savedConnection = await getSavedConnection(connection);
  const oauth = await getOAuth(savedConnection);
  return googleAnalyticsConnection.getAccounts(oauth.refreshToken, savedConnection.oauth_id);
}

function testUnsavedConnection({ connection }) {
  return testConnection({ connection });
}

async function getBuilderMetadata({ connection, options = {} }) {
  const savedConnection = await getSavedConnection(connection);
  const accounts = await testConnection({ connection: savedConnection });
  let metadata = null;

  if (options.propertyId) {
    const oauth = await getOAuth(savedConnection);
    metadata = await googleAnalyticsConnection.getMetadata(oauth.refreshToken, options.propertyId);
  }

  return {
    accounts,
    metadata,
  };
}

async function runDataRequest({
  connection,
  dataRequest,
  getCache,
  auditContext = null,
}) {
  const savedConnection = await getSavedConnection(connection);

  if (getCache && savedConnection?.id) {
    const drCache = await checkAndGetCache(savedConnection.id, dataRequest);
    if (drCache) {
      await completeConnectorAudit(auditContext, {
        cacheHit: true,
        connectionType: "googleAnalytics",
        ...serializeResponsePreview(drCache.responseData),
      });
      return drCache;
    }
  }

  try {
    const responseData = await fetchAnalytics(savedConnection, dataRequest, auditContext);
    const dataToCache = {
      dataRequest,
      responseData: {
        data: responseData,
      },
      connection_id: savedConnection.id,
    };

    await drCacheController.create(dataRequest.id, dataToCache);
    await completeConnectorAudit(auditContext, {
      cacheHit: false,
      connectionType: "googleAnalytics",
      ...serializeResponsePreview(dataToCache.responseData),
    });

    return dataToCache;
  } catch (err) {
    await failConnectorAudit(auditContext, err, err.auditStage || "connection", {
      cacheHit: false,
      connectionType: "googleAnalytics",
    });
    return Promise.reject(err);
  }
}

async function fetchAnalytics(connection, dataRequest, auditContext) {
  const oauth = await getOAuth(connection);
  return googleAnalyticsConnection.getAnalytics(oauth, dataRequest, { connection, auditContext });
}

module.exports = {
  fetchAnalytics,
  getBuilderMetadata,
  getOAuth,
  getSavedConnection,
  runDataRequest,
  testConnection,
  testUnsavedConnection,
};
