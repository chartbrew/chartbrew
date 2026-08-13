const {
  Client,
  StreamableHTTPClientTransport,
} = require("@modelcontextprotocol/client");

const { MCP_LIMITS } = require("./mcp.constants");
const {
  normalizeCustomHeaders,
  normalizeEndpoint,
  sanitizeMcpClientError,
} = require("./mcp.policy");
const { createMcpSafeFetch } = require("./mcp.safeFetch");

function getAuthentication(connection) {
  return connection?.authentication && typeof connection.authentication === "object"
    ? connection.authentication
    : { type: "none" };
}

function getAuthProvider(authentication) {
  if (authentication.type === "bearer" && authentication.token) {
    return { token: async () => authentication.token };
  }
  if (authentication.type === "oauth" && authentication.accessToken) {
    return { token: async () => authentication.accessToken };
  }
  return undefined;
}

function getRequestHeaders(connection, authentication) {
  if (authentication.type !== "headers") return {};
  return normalizeCustomHeaders(
    connection?.options?.mcp?.headers || authentication.headers || {}
  );
}

async function createMcpClient(connection, context = {}) {
  const endpoint = normalizeEndpoint(connection?.host);
  const authentication = getAuthentication(connection);
  const safeFetch = createMcpSafeFetch({
    teamId: connection?.team_id || context.teamId,
    connectionId: connection?.id || context.connectionId,
    userId: context.userId,
  });
  const client = new Client({
    name: "chartbrew",
    version: process.env.npm_package_version || "1.0.0",
  }, {
    inputRequired: { autoFulfill: false },
    listMaxPages: MCP_LIMITS.maxToolPages,
    versionNegotiation: {
      mode: "auto",
      probe: { timeoutMs: MCP_LIMITS.connectTimeoutMs, maxRetries: 0 },
    },
  });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    authProvider: getAuthProvider(authentication),
    fetch: safeFetch.fetch,
    onInsufficientScope: "throw",
    requestInit: {
      headers: getRequestHeaders(connection, authentication),
    },
  });

  try {
    await client.connect(transport, {
      timeout: MCP_LIMITS.connectTimeoutMs,
      maxTotalTimeout: MCP_LIMITS.connectTimeoutMs,
    });
  } catch (error) {
    await Promise.allSettled([client.close(), safeFetch.close()]);
    throw sanitizeMcpClientError(error);
  }

  return {
    client,
    endpoint,
    transport,
    close: async () => {
      await Promise.allSettled([client.close(), safeFetch.close()]);
    },
  };
}

async function withMcpClient(connection, callback, context = {}) {
  const session = await createMcpClient(connection, context);
  try {
    return await callback(session.client, session);
  } catch (error) {
    throw sanitizeMcpClientError(error);
  } finally {
    await session.close();
  }
}

module.exports = {
  createMcpClient,
  withMcpClient,
};
