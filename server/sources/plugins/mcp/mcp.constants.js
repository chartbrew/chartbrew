const MCP_LIMITS = Object.freeze({
  callTimeoutMs: 30000,
  catalogPrivateTtlMs: 5 * 60 * 1000,
  catalogPublicTtlMs: 60 * 60 * 1000,
  catalogLegacyTtlMs: 60 * 1000,
  connectTimeoutMs: 15000,
  descriptionCharacters: 2000,
  errorDetailsCharacters: 500,
  iconBytes: 128 * 1024,
  maxCatalogBytes: 1024 * 1024,
  maxRedirects: 5,
  maxResponseBytes: 5 * 1024 * 1024,
  maxResultRows: 10000,
  maxSchemaBytes: 64 * 1024,
  maxSchemaDepth: 20,
  maxToolPages: 32,
  maxTools: 250,
  oauthTimeoutMs: 20000,
});

const MCP_AUTH_TYPES = Object.freeze([
  "none",
  "bearer",
  "headers",
  "oauth",
]);

const MCP_RESERVED_HEADERS = new Set([
  "accept",
  "authorization",
  "connection",
  "content-length",
  "content-type",
  "cookie",
  "host",
  "mcp-method",
  "mcp-protocol-version",
  "mcp-session-id",
  "origin",
  "proxy-authorization",
  "set-cookie",
  "transfer-encoding",
]);

module.exports = {
  MCP_AUTH_TYPES,
  MCP_LIMITS,
  MCP_RESERVED_HEADERS,
};
