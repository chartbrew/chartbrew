const crypto = require("crypto");
const { auth } = require("@modelcontextprotocol/client");

const db = require("../../../models/models");
const { createMcpSafeFetch } = require("./mcp.safeFetch");
const { createMcpError, sanitizeMcpClientError } = require("./mcp.policy");

const refreshes = new Map();

function getApiBaseUrl() {
  const value = process.env.NODE_ENV === "production"
    ? process.env.VITE_APP_API_HOST
    : process.env.VITE_APP_API_HOST_DEV;
  if (!value) {
    throw createMcpError(
      "MCP_OAUTH_CALLBACK_MISSING",
      "Set the public Chartbrew API URL before using MCP OAuth."
    );
  }
  return String(value).replace(/\/+$/, "");
}

function getCallbackUrl(connection) {
  return `${getApiBaseUrl()}/team/${connection.team_id}/connections/${connection.id}/mcp/oauth/callback`;
}

function getClientMetadataUrl(connection) {
  const apiBaseUrl = new URL(getApiBaseUrl());
  if (apiBaseUrl.protocol !== "https:") return undefined;
  const metadataUrl = new URL("/mcp/oauth/client-metadata", apiBaseUrl);
  metadataUrl.searchParams.set("team_id", connection.team_id);
  metadataUrl.searchParams.set("connection_id", connection.id);
  return metadataUrl.toString();
}

function getClientMetadata(connection) {
  const callbackUrl = getCallbackUrl(connection);
  return {
    client_name: "Chartbrew",
    redirect_uris: [callbackUrl],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
}

function buildOauthProvider(connection) {
  const stored = { ...(connection.authentication || {}) };
  const callbackUrl = getCallbackUrl(connection);
  const registeredClient = process.env.CB_MCP_OAUTH_CLIENT_ID
    ? {
      client_id: process.env.CB_MCP_OAUTH_CLIENT_ID,
      client_secret: process.env.CB_MCP_OAUTH_CLIENT_SECRET || undefined,
    }
    : null;
  let authorizationUrl = null;
  const clientMetadata = getClientMetadata(connection);

  const provider = {
    redirectUrl: callbackUrl,
    clientMetadata: {
      ...clientMetadata,
      token_endpoint_auth_method: registeredClient?.client_secret ? "client_secret_basic" : "none",
    },
    clientMetadataUrl: registeredClient ? undefined : getClientMetadataUrl(connection),
    state: () => stored.state,
    clientInformation: () => stored.clientInformation || registeredClient || undefined,
    saveClientInformation: (clientInformation) => {
      stored.clientInformation = clientInformation;
    },
    tokens: () => stored.oauthTokens || undefined,
    saveTokens: (tokens) => {
      stored.oauthTokens = tokens;
      stored.accessToken = tokens.access_token || "";
      stored.refreshToken = tokens.refresh_token || stored.refreshToken || "";
      stored.scope = tokens.scope || stored.scope || "";
      stored.expiresAt = tokens.expires_in
        ? new Date(Date.now() + (Number(tokens.expires_in) * 1000)).toISOString()
        : null;
    },
    redirectToAuthorization: (url) => {
      authorizationUrl = url.toString();
    },
    saveCodeVerifier: (codeVerifier) => {
      stored.codeVerifier = codeVerifier;
    },
    codeVerifier: () => stored.codeVerifier,
    saveAuthorizationServerUrl: (url) => {
      stored.authorizationServerUrl = url;
    },
    authorizationServerUrl: () => stored.authorizationServerUrl || undefined,
    saveResourceUrl: (url) => {
      stored.resourceUrl = url;
    },
    resourceUrl: () => stored.resourceUrl || undefined,
    saveDiscoveryState: (state) => {
      stored.discoveryState = state;
    },
    discoveryState: () => stored.discoveryState || undefined,
    invalidateCredentials: (scope) => {
      if (["all", "tokens"].includes(scope)) {
        stored.oauthTokens = null;
        stored.accessToken = "";
        stored.refreshToken = "";
      }
      if (["all", "client"].includes(scope)) stored.clientInformation = null;
      if (["all", "verifier"].includes(scope)) stored.codeVerifier = "";
      if (["all", "discovery"].includes(scope)) stored.discoveryState = null;
    },
  };

  return {
    getAuthorizationUrl: () => authorizationUrl,
    provider,
    stored,
  };
}

async function runOauth(connection, options = {}) {
  const oauth = buildOauthProvider(connection);
  const safeFetch = createMcpSafeFetch({
    teamId: connection.team_id,
    connectionId: connection.id,
  });
  try {
    const result = await auth(oauth.provider, {
      serverUrl: connection.host,
      authorizationCode: options.authorizationCode,
      iss: options.iss,
      scope: connection.authentication?.scope || undefined,
      forceReauthorization: options.forceReauthorization === true,
      fetchFn: safeFetch.fetch,
    });
    return {
      result,
      authorizationUrl: oauth.getAuthorizationUrl(),
      authentication: oauth.stored,
    };
  } catch (error) {
    throw sanitizeMcpClientError(error);
  } finally {
    await safeFetch.close();
  }
}

async function startOAuth({ connection, user }) {
  if (!user?.isEditor) {
    throw createMcpError("MCP_ADMIN_REQUIRED", "Only team owners and admins can manage MCP OAuth.", 403);
  }
  const plain = connection?.toJSON ? connection.toJSON() : { ...connection };
  if (plain.authentication?.type !== "oauth") {
    throw createMcpError("MCP_OAUTH_NOT_SELECTED", "Select OAuth on this MCP connection first.");
  }
  plain.authentication = {
    ...plain.authentication,
    state: crypto.randomBytes(32).toString("hex"),
    codeVerifier: "",
  };
  const result = await runOauth(plain, { forceReauthorization: true });
  if (result.result !== "REDIRECT" || !result.authorizationUrl) {
    throw createMcpError("MCP_OAUTH_START_FAILED", "The MCP server did not start OAuth.");
  }
  await db.Connection.update({
    authentication: result.authentication,
    active: false,
    schema: {
      ...(plain.schema || {}),
      mcp: {
        ...(plain.schema?.mcp || {}),
        setupRequired: "oauth",
        setupExpiresAt: new Date(Date.now() + (30 * 60 * 1000)).toISOString(),
      },
    },
  }, { where: { id: plain.id, team_id: plain.team_id } });
  return { url: result.authorizationUrl };
}

async function completeOAuth({ connection, code, state, iss }) {
  const plain = connection?.toJSON ? connection.toJSON() : { ...connection };
  const setupExpiresAt = Date.parse(plain.schema?.mcp?.setupExpiresAt || "");
  if (!Number.isFinite(setupExpiresAt) || setupExpiresAt <= Date.now()) {
    throw createMcpError(
      "MCP_OAUTH_SETUP_EXPIRED",
      "The MCP OAuth setup expired. Start the connection again.",
      400
    );
  }
  const returnedState = Buffer.from(String(state || ""));
  const savedState = Buffer.from(String(plain.authentication?.state || ""));
  if (!code || !returnedState.length || returnedState.length !== savedState.length
    || !crypto.timingSafeEqual(returnedState, savedState)) {
    throw createMcpError("MCP_OAUTH_STATE_INVALID", "The MCP OAuth response is not valid.");
  }

  const result = await runOauth(plain, { authorizationCode: code, iss });
  if (result.result !== "AUTHORIZED" || !result.authentication.accessToken) {
    throw createMcpError("MCP_OAUTH_FAILED", "MCP OAuth did not return an access token.");
  }
  result.authentication.state = "";
  result.authentication.codeVerifier = "";
  await db.Connection.update({
    authentication: result.authentication,
  }, { where: { id: plain.id, team_id: plain.team_id } });
  return {
    ...plain,
    authentication: result.authentication,
  };
}

async function refreshOAuth(connection) {
  const plain = connection?.toJSON ? connection.toJSON() : { ...connection };
  const lockKey = `${plain.team_id}:${plain.id}`;
  if (refreshes.has(lockKey)) return refreshes.get(lockKey);

  const refresh = (async () => {
    const result = await runOauth(plain);
    if (result.result !== "AUTHORIZED" || !result.authentication.accessToken) {
      throw createMcpError("MCP_OAUTH_REFRESH_FAILED", "Reconnect the MCP server.", 401);
    }
    await db.Connection.update({ authentication: result.authentication }, {
      where: { id: plain.id, team_id: plain.team_id },
    });
    return { ...plain, authentication: result.authentication };
  })();
  refreshes.set(lockKey, refresh);
  try {
    return await refresh;
  } finally {
    refreshes.delete(lockKey);
  }
}

module.exports = {
  completeOAuth,
  getCallbackUrl,
  getClientMetadata,
  getClientMetadataUrl,
  refreshOAuth,
  startOAuth,
};
