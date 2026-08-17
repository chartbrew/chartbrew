const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const db = require("../../../models/models");
const drCacheController = require("../../../controllers/DataRequestCacheController");
const { serializeResponsePreview } = require("../../../modules/updateAudit");
const {
  checkAndGetCache,
  completeConnectorAudit,
  failConnectorAudit,
} = require("../../shared/connectorRuntime");
const { MCP_LIMITS } = require("./mcp.constants");
const { withMcpClient } = require("./mcp.client");
const { discoverMcpConnection } = require("./mcp.discovery");
const { normalizeToolResult, selectToolOutput } = require("./mcp.normalize");
const mcpOauth = require("./mcp.oauth");
const {
  assertToolApproved,
  createMcpError,
  normalizeAuthentication,
  normalizeEndpoint,
  sanitizeTool,
} = require("./mcp.policy");
const { applyVariables } = require("./mcp.variables");

const ajv = new Ajv2020({
  allErrors: true,
  allowUnionTypes: true,
  strict: false,
  validateFormats: true,
});
addFormats(ajv);

const DEFAULT_DATA_REQUEST = {
  method: "POST",
  route: null,
  headers: {},
  body: null,
  conditions: null,
  configuration: {
    source: "mcp",
    tool: { name: "", contractFingerprint: "" },
    arguments: {},
    output: { mode: "auto", path: [] },
  },
  query: null,
  pagination: false,
  items: null,
  itemsLimit: null,
  offset: null,
  paginationField: null,
  template: "mcp",
  useGlobalHeaders: true,
};

function toPlain(value) {
  if (value?.toJSON) return value.toJSON();
  if (value?.get) return value.get({ plain: true });
  return value ? { ...value } : {};
}

async function getSavedConnection(connection) {
  if (!connection?.id) return toPlain(connection);
  const saved = await db.Connection.findByPk(connection.id);
  const plain = toPlain(saved || connection);
  if (plain.authentication?.type === "oauth" && plain.authentication?.accessToken) {
    const expiresAt = Date.parse(plain.authentication.expiresAt || "");
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now() + 60000) {
      return mcpOauth.refreshOAuth(plain);
    }
  }
  return plain;
}

function preserveAuthenticationSecrets(authentication, existingAuthentication = {}) {
  const normalized = normalizeAuthentication(authentication);
  if (normalized.type !== existingAuthentication?.type) return normalized;

  if (normalized.type === "bearer" && !normalized.token) {
    normalized.token = existingAuthentication.token || "";
  }
  if (normalized.type === "headers") {
    normalized.headers = Object.entries(normalized.headers).reduce((result, [key, value]) => {
      result[key] = value || existingAuthentication.headers?.[key] || "";
      return result;
    }, {});
  }
  if (normalized.type === "oauth") {
    [
      "accessToken",
      "refreshToken",
      "clientInformation",
      "oauthTokens",
      "codeVerifier",
      "state",
      "resourceMetadataUrl",
      "resourceUrl",
      "authorizationServerUrl",
      "discoveryState",
    ].forEach((key) => {
      if (!normalized[key]) normalized[key] = existingAuthentication[key] || normalized[key];
    });
  }
  return normalized;
}

function stampRequestedApprovals(allowedTools, user) {
  return Object.entries(allowedTools || {}).reduce((result, [name, approval]) => {
    if (!approval || typeof approval !== "object") return result;
    result[name] = {
      ...approval,
      approvedAt: new Date().toISOString(),
      approvedBy: user?.id || approval.approvedBy || null,
    };
    return result;
  }, {});
}

async function prepareConnectionData({ connection, existingConnection = null, user = null }) {
  const incoming = toPlain(connection);
  const existing = toPlain(existingConnection);
  const authentication = preserveAuthenticationSecrets(
    incoming.authentication || {},
    existing.authentication || {}
  );
  const incomingHeaders = authentication.type === "headers"
    ? authentication.headers || {}
    : {};
  const savedHeaders = existing.options?.mcp?.headers || existing.authentication?.headers || {};
  const customHeaders = Object.entries(incomingHeaders).reduce((result, [name, value]) => {
    result[name] = value || savedHeaders[name] || "";
    return result;
  }, {});
  if (authentication.type === "headers") {
    delete authentication.headers;
  }
  const normalized = {
    ...incoming,
    type: "mcp",
    subType: "mcp",
    host: normalizeEndpoint(incoming.host || existing.host),
    authentication,
    options: {
      ...(existing.options || {}),
      ...(incoming.options || {}),
      mcp: {
        ...(existing.options?.mcp || {}),
        ...(incoming.options?.mcp || {}),
        ...(authentication.type === "headers" ? { headers: customHeaders } : { headers: {} }),
      },
    },
  };
  delete normalized.options.mcp.allowPrivateHost;

  if (authentication.type === "oauth" && !authentication.accessToken) {
    return {
      ...normalized,
      active: false,
      schema: {
        ...(existing.schema || {}),
        mcp: {
          ...(existing.schema?.mcp || {}),
          allowedTools: {},
          setupRequired: "oauth",
          setupExpiresAt: new Date(Date.now() + (30 * 60 * 1000)).toISOString(),
        },
      },
    };
  }

  const requestedApprovals = stampRequestedApprovals(
    incoming.schema?.mcp?.allowedTools,
    user
  );
  const discovery = await discoverMcpConnection(normalized, {
    allowedTools: requestedApprovals,
    loadIcon: true,
  });
  return {
    ...normalized,
    active: true,
    schema: {
      ...(existing.schema || {}),
      ...(incoming.schema || {}),
      mcp: discovery,
    },
  };
}

function authorizeConnectionWrite({ user }) {
  if (!user?.isEditor) {
    throw createMcpError(
      "MCP_ADMIN_REQUIRED",
      "Only team owners and admins can manage MCP connections.",
      403
    );
  }
}

function redactConnection({ connection }) {
  const value = toPlain(connection);
  const authentication = value.authentication || {};
  return {
    ...value,
    authentication: {
      type: authentication.type || "none",
      hasToken: Boolean(authentication.token || authentication.accessToken),
      hasRefreshToken: Boolean(authentication.refreshToken),
      expiresAt: authentication.expiresAt || null,
      headerNames: authentication.type === "headers"
        ? Object.keys(value.options?.mcp?.headers || authentication.headers || {})
        : [],
    },
    options: {
      mcp: {},
    },
  };
}

async function refreshDiscovery(connection, options = {}) {
  const savedConnection = await getSavedConnection(connection);
  const discovery = await discoverMcpConnection(savedConnection, {
    allowedTools: savedConnection?.schema?.mcp?.allowedTools,
    loadIcon: options.loadIcon !== false,
  });
  if (savedConnection.id && options.persist !== false) {
    await db.Connection.update({
      schema: {
        ...(savedConnection.schema || {}),
        mcp: discovery,
      },
      active: true,
    }, { where: { id: savedConnection.id } });
  }
  return { savedConnection, discovery };
}

async function testConnection({ connection }) {
  const { discovery } = await refreshDiscovery(connection);
  return { success: true, discovery };
}

async function testUnsavedConnection({ connection }) {
  const normalized = {
    ...toPlain(connection),
    host: normalizeEndpoint(connection?.host),
    authentication: normalizeAuthentication(connection?.authentication || {}),
  };
  const discovery = await discoverMcpConnection(normalized, {
    allowedTools: connection?.schema?.mcp?.allowedTools,
    loadIcon: true,
  });
  return { success: true, discovery };
}

function getDefaultDataRequest() {
  return JSON.parse(JSON.stringify(DEFAULT_DATA_REQUEST));
}

async function completeOAuth(options) {
  const authenticatedConnection = await mcpOauth.completeOAuth(options);
  const discovery = await discoverMcpConnection(authenticatedConnection, {
    allowedTools: {},
    loadIcon: true,
  });
  await db.Connection.update({
    active: true,
    schema: {
      ...(authenticatedConnection.schema || {}),
      mcp: discovery,
    },
  }, { where: { id: authenticatedConnection.id, team_id: authenticatedConnection.team_id } });
  return discovery;
}

function oauthClientMetadata({ connection }) {
  return mcpOauth.getClientMetadata(connection);
}

async function getBuilderMetadata({ connection }) {
  const { discovery } = await refreshDiscovery(connection, { loadIcon: false });
  return {
    server: discovery.server,
    protocolVersion: discovery.protocolVersion,
    tools: discovery.tools.map((tool) => ({
      ...tool,
      approval: discovery.allowedTools?.[tool.name] || null,
    })),
  };
}

function getSchema({ connection }) {
  return Promise.resolve({
    tools: connection?.schema?.mcp?.tools || [],
    allowedTools: connection?.schema?.mcp?.allowedTools || {},
  });
}

function getConfiguration(dataRequest = {}) {
  const configuration = dataRequest.configuration || {};
  return {
    source: "mcp",
    tool: {
      name: configuration.tool?.name || "",
      contractFingerprint: configuration.tool?.contractFingerprint || "",
    },
    arguments: configuration.arguments && typeof configuration.arguments === "object"
      && !Array.isArray(configuration.arguments)
      ? configuration.arguments
      : {},
    output: {
      mode: configuration.output?.mode || "auto",
      path: configuration.output?.path || [],
    },
  };
}

function validateConfiguration(configuration, options = {}) {
  const config = getConfiguration({ configuration });
  const errors = [];
  if (configuration?.source !== "mcp") errors.push("The data source must be MCP.");
  if (!config.tool.name) errors.push("Choose an MCP tool.");
  if (!config.tool.contractFingerprint) errors.push("The MCP tool approval is missing.");
  if (options.tool && config.tool.contractFingerprint !== options.tool.contractFingerprint) {
    errors.push("The MCP tool changed after this dataset was saved.");
  }
  return { valid: errors.length === 0, errors, configuration: config };
}

function validateArguments(tool, args) {
  let validate;
  try {
    validate = ajv.compile(tool.inputSchema || { type: "object" });
  } catch (error) {
    throw createMcpError("MCP_INVALID_TOOL_SCHEMA", "The MCP tool input schema is not valid.");
  }
  if (!validate(args)) {
    const message = ajv.errorsText(validate.errors, { separator: "; ", dataVar: "arguments" });
    throw createMcpError("MCP_INVALID_ARGUMENTS", message || "The MCP tool arguments are not valid.");
  }
}

async function executeTool(connection, dataRequest, approvalUse = "datasets") {
  const config = getConfiguration(dataRequest);
  return withMcpClient(connection, async (client) => {
    const catalogExpiresAt = Date.parse(connection?.schema?.mcp?.catalogCache?.expiresAt || "");
    const hasFreshCatalog = Number.isFinite(catalogExpiresAt)
      && catalogExpiresAt > Date.now()
      && Array.isArray(connection?.schema?.mcp?.tools);
    const tools = hasFreshCatalog
      ? connection.schema.mcp.tools.map(sanitizeTool)
      : (await client.listTools(undefined, { cacheMode: "refresh" })).tools.map(sanitizeTool);
    const tool = tools.find((item) => item.name === config.tool.name);
    if (!tool) {
      throw createMcpError("MCP_TOOL_NOT_FOUND", "The selected MCP tool is no longer available.", 404);
    }
    assertToolApproved(connection, tool, approvalUse);
    if (config.tool.contractFingerprint !== tool.contractFingerprint) {
      throw createMcpError("MCP_TOOL_CHANGED", "This MCP tool changed after the dataset was saved.", 409);
    }
    validateArguments(tool, config.arguments);

    const result = await client.callTool({
      name: tool.name,
      arguments: config.arguments,
    }, {
      timeout: MCP_LIMITS.callTimeoutMs,
      maxTotalTimeout: MCP_LIMITS.callTimeoutMs,
      toolDefinition: {
        name: tool.name,
        title: tool.title || undefined,
        description: tool.description || undefined,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema || undefined,
        annotations: tool.annotations,
      },
    });
    return {
      data: selectToolOutput(normalizeToolResult(result), config.output),
      config,
      tool,
    };
  });
}

async function runDataRequest({
  connection,
  dataRequest,
  getCache,
  processedDataRequest = null,
  auditContext = null,
}) {
  const startedAt = Date.now();
  const savedConnection = await getSavedConnection(connection);
  if (getCache && savedConnection.id && dataRequest?.id) {
    const cached = await checkAndGetCache(savedConnection.id, dataRequest);
    if (cached) {
      let response = cached;
      try {
        const data = cached.responseData?.data;
        if (data !== undefined) {
          response = {
            ...cached,
            responseData: {
              ...cached.responseData,
              data: selectToolOutput(data, getConfiguration(processedDataRequest || dataRequest).output),
            },
          };
        }
      } catch (_error) {
        response = cached;
      }
      await completeConnectorAudit(auditContext, {
        cacheHit: true,
        connectionType: "mcp",
        durationMs: Date.now() - startedAt,
        ...serializeResponsePreview(response.responseData),
      });
      return response;
    }
  }

  const requestToRun = processedDataRequest || dataRequest;
  try {
    const execution = await executeTool(savedConnection, requestToRun, "datasets");
    const dataToCache = {
      dataRequest,
      responseData: {
        data: execution.data,
        configuration: {
          source: "mcp",
          tool: execution.tool.name,
        },
      },
      connection_id: savedConnection.id,
    };
    if (dataRequest?.id) {
      await drCacheController.create(dataRequest.id, dataToCache);
    }
    await completeConnectorAudit(auditContext, {
      cacheHit: false,
      connectionType: "mcp",
      tool: execution.tool.name,
      durationMs: Date.now() - startedAt,
      ...serializeResponsePreview(dataToCache.responseData),
    });
    return dataToCache;
  } catch (error) {
    await failConnectorAudit(auditContext, error, "connection", {
      cacheHit: false,
      connectionType: "mcp",
      tool: requestToRun?.configuration?.tool?.name || "",
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

function previewDataRequest(options) {
  return runDataRequest({ ...options, getCache: false });
}

module.exports = {
  _private: {
    executeTool,
    getConfiguration,
    preserveAuthenticationSecrets,
    validateArguments,
  },
  applyVariables,
  authorizeConnectionWrite,
  actions: {
    startOAuth: mcpOauth.startOAuth,
  },
  completeOAuth,
  getDefaultDataRequest,
  getBuilderMetadata,
  getSavedConnection,
  getSchema,
  oauthClientMetadata,
  prepareConnectionData,
  previewDataRequest,
  redactConnection,
  refreshDiscovery,
  runDataRequest,
  testConnection,
  testUnsavedConnection,
  validateConfiguration,
};
