const crypto = require("crypto");

const { MCP_AUTH_TYPES, MCP_LIMITS, MCP_RESERVED_HEADERS } = require("./mcp.constants");

function createMcpError(code, message, statusCode = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  Object.assign(error, details);
  return error;
}

const NETWORK_ERROR_DETAILS = {
  CERT_HAS_EXPIRED: "The TLS certificate has expired.",
  EAI_AGAIN: "The hostname could not be resolved.",
  ECONNREFUSED: "The connection was refused.",
  ECONNRESET: "The connection was reset.",
  ENETUNREACH: "The network is unreachable.",
  ENOTFOUND: "The hostname could not be resolved.",
  ERR_TLS_CERT_ALTNAME_INVALID: "The TLS certificate does not match the hostname.",
  ETIMEDOUT: "The connection timed out.",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "The TLS certificate could not be verified.",
};

function redactErrorSecrets(value, options = {}) {
  let text = String(value || "");
  if (!options.keepBearerScheme) {
    text = text.replace(/Bearer\s+[A-Za-z0-9._\-+/=]{12,}/g, "Bearer [redacted]");
  }
  return text
    .replace(
      /"(authorization|access_token|refresh_token|client_secret|password|secret|token|api[_-]?key)"\s*:\s*"[^"]*"/gi,
      "\"$1\":\"[redacted]\""
    )
    .replace(
      /([?&](?:access_token|refresh_token|token|key|secret|password|api[_-]?key)=)[^&]*/gi,
      "$1[redacted]"
    );
}

function getSafeConnectionErrorDetails(error, options = {}) {
  const httpError = options.httpError || {};
  const parts = [];
  const httpStatus = Number(error?.status || httpError.status);
  const statusText = String(error?.statusText || httpError.statusText || "").trim().slice(0, 80);
  if (Number.isInteger(httpStatus) && httpStatus >= 400 && httpStatus <= 599) {
    parts.push(statusText ? `HTTP ${httpStatus} ${statusText}` : `HTTP ${httpStatus}`);
  } else {
    const match = String(error?.message || "").match(/\bHTTP\s+(\d{3})\b/i);
    if (match) parts.push(`HTTP ${match[1]}`);
    else if (String(error?.name || "").toLowerCase().includes("unauthorized")) {
      parts.push("HTTP 401 Unauthorized");
    }
  }

  let responseText = typeof error?.text === "string" ? error.text : "";
  if (!responseText && typeof httpError.text === "string") responseText = httpError.text;
  if (!responseText) {
    const posted = String(error?.message || "").match(
      /Error POSTing to endpoint(?: \(HTTP \d+\))?:\s*([\s\S]*)/i
    );
    if (posted) responseText = posted[1];
  }
  responseText = redactErrorSecrets(responseText).trim().slice(0, MCP_LIMITS.errorDetailsCharacters);
  if (responseText && !parts.includes(responseText)) parts.push(responseText);

  const wwwAuthenticate = redactErrorSecrets(
    error?.wwwAuthenticate || httpError.wwwAuthenticate || "",
    { keepBearerScheme: true }
  ).trim();
  if (wwwAuthenticate) parts.push(`WWW-Authenticate: ${wwwAuthenticate}`);

  if (parts.length === 0) {
    const causeCode = error?.cause?.code || error?.code;
    const mapped = NETWORK_ERROR_DETAILS[String(causeCode || "")];
    if (mapped) parts.push(mapped);
  }

  return parts.join("\n").slice(0, MCP_LIMITS.errorDetailsCharacters + 64) || undefined;
}

function withErrorDetails(error, options = {}, extra = {}) {
  const details = getSafeConnectionErrorDetails(error, options);
  return details ? { ...extra, details } : extra;
}

function sanitizeMcpClientError(error, options = {}) {
  if (String(error?.code || "").startsWith("MCP_") || error?.code === "SSRF_BLOCKED") {
    if (!error.details) {
      const details = getSafeConnectionErrorDetails(error, options);
      if (details) error.details = details;
    }
    return error;
  }
  const name = String(error?.name || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  const statusCode = Number(error?.statusCode || error?.status || options.httpError?.status);
  if (name.includes("insufficientscope") || code.includes("insufficient_scope")) {
    return createMcpError(
      "MCP_APPROVE_ACCESS",
      "Approve access for this MCP connection, then try again.",
      403,
      withErrorDetails(error, options)
    );
  }
  if (name.includes("unauthorized") || statusCode === 401) {
    return createMcpError(
      "MCP_RECONNECT_REQUIRED",
      "The MCP server rejected authentication. Check the credentials and try again.",
      401,
      withErrorDetails(error, options)
    );
  }
  if (name.includes("timeout") || name.includes("abort") || code.includes("timeout")) {
    return createMcpError(
      "MCP_TIMEOUT",
      "The MCP server did not respond in time.",
      504,
      withErrorDetails(error, options)
    );
  }
  return createMcpError(
    "MCP_REQUEST_FAILED",
    "The MCP server request failed. Check the connection and try again.",
    502,
    withErrorDetails(error, options)
  );
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;

  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

function fingerprint(value) {
  return crypto.createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function trimText(value, limit = MCP_LIMITS.descriptionCharacters) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, limit);
}

function assertObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createMcpError("MCP_INVALID_CONFIGURATION", message);
  }
}

function normalizeEndpoint(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch (error) {
    throw createMcpError("MCP_INVALID_ENDPOINT", "Enter a valid MCP server URL.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw createMcpError("MCP_INVALID_ENDPOINT", "The MCP server URL must use HTTP or HTTPS.");
  }
  if (url.username || url.password) {
    throw createMcpError("MCP_INVALID_ENDPOINT", "Do not include credentials in the MCP server URL.");
  }
  url.hash = "";
  return url.toString();
}

function normalizeCustomHeaders(headers = {}) {
  if (headers === null || headers === undefined || headers === "") return {};
  assertObject(headers, "Custom headers must be a JSON object.");

  const normalized = {};
  Object.entries(headers).forEach(([name, value]) => {
    const normalizedName = String(name || "").trim().toLowerCase();
    if (!normalizedName || !/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(normalizedName)) {
      throw createMcpError("MCP_INVALID_HEADER", "A custom header name is not valid.");
    }
    if (MCP_RESERVED_HEADERS.has(normalizedName)) {
      throw createMcpError("MCP_RESERVED_HEADER", `The ${name} header is managed by Chartbrew.`);
    }
    if (typeof value !== "string" || /[\r\n]/.test(value)) {
      throw createMcpError("MCP_INVALID_HEADER", `The ${name} header value is not valid.`);
    }
    normalized[normalizedName] = value;
  });

  return normalized;
}

function normalizeAuthentication(authentication = {}) {
  const type = authentication?.type || "none";
  if (!MCP_AUTH_TYPES.includes(type)) {
    throw createMcpError("MCP_INVALID_AUTH", "Choose a supported authentication method.");
  }

  if (type === "bearer") {
    return { type, token: String(authentication.token || "").trim() };
  }
  if (type === "headers") {
    return { type, headers: normalizeCustomHeaders(authentication.headers) };
  }
  if (type === "oauth") {
    return {
      type,
      accessToken: String(authentication.accessToken || ""),
      refreshToken: String(authentication.refreshToken || ""),
      expiresAt: authentication.expiresAt || null,
      scope: trimText(authentication.scope, 2000),
      clientInformation: authentication.clientInformation || null,
      oauthTokens: authentication.oauthTokens || null,
      codeVerifier: authentication.codeVerifier || "",
      state: authentication.state || "",
      resourceMetadataUrl: authentication.resourceMetadataUrl || "",
      resourceUrl: authentication.resourceUrl || "",
      authorizationServerUrl: authentication.authorizationServerUrl || "",
      discoveryState: authentication.discoveryState || null,
    };
  }
  return { type: "none" };
}

function getSchemaDepth(value, depth = 0) {
  if (!value || typeof value !== "object") return depth;
  const children = Array.isArray(value) ? value : Object.values(value);
  return children.reduce((max, child) => Math.max(max, getSchemaDepth(child, depth + 1)), depth);
}

function sanitizeSchema(schema, label) {
  const value = schema && typeof schema === "object" && !Array.isArray(schema)
    ? canonicalize(schema)
    : { type: "object", properties: {} };
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized) > MCP_LIMITS.maxSchemaBytes) {
    throw createMcpError("MCP_SCHEMA_TOO_LARGE", `${label} is too large to use safely.`);
  }
  if (getSchemaDepth(value) > MCP_LIMITS.maxSchemaDepth) {
    throw createMcpError("MCP_SCHEMA_TOO_DEEP", `${label} is too deeply nested to use safely.`);
  }
  if (serialized.includes('"$ref"') && /"\$ref"\s*:\s*"(https?:|file:|\/)/i.test(serialized)) {
    throw createMcpError("MCP_EXTERNAL_SCHEMA_REFERENCE", `${label} contains an external reference.`);
  }
  return value;
}

function sanitizeTool(tool) {
  if (!tool?.name || typeof tool.name !== "string") {
    throw createMcpError("MCP_INVALID_TOOL", "The MCP server returned a tool without a name.");
  }

  const inputSchema = sanitizeSchema(tool.inputSchema, `${tool.name} input schema`);
  const outputSchema = tool.outputSchema
    ? sanitizeSchema(tool.outputSchema, `${tool.name} output schema`)
    : null;
  const annotations = tool.annotations && typeof tool.annotations === "object"
    ? {
      readOnlyHint: tool.annotations.readOnlyHint === true,
      destructiveHint: tool.annotations.destructiveHint === true,
      idempotentHint: tool.annotations.idempotentHint === true,
      openWorldHint: tool.annotations.openWorldHint === true,
    }
    : {};

  const sanitized = {
    name: tool.name.trim().slice(0, 256),
    title: trimText(tool.title, 256),
    description: trimText(tool.description),
    inputSchema,
    outputSchema,
    annotations,
  };
  sanitized.contractFingerprint = fingerprint({
    name: sanitized.name,
    inputSchema,
    outputSchema,
  });
  sanitized.riskFingerprint = fingerprint({
    name: sanitized.name,
    description: sanitized.description,
    annotations,
  });
  return sanitized;
}

function isToolReadOnly(tool, approval = {}) {
  if (tool?.annotations?.destructiveHint === true) return false;
  return approval.confirmedReadOnly === true;
}

function mergeApprovals(tools, requested = {}) {
  return tools.reduce((result, tool) => {
    if (tool.annotations?.destructiveHint === true) return result;

    const approval = requested?.[tool.name];
    if (!approval) return result;
    if (approval.contractFingerprint !== tool.contractFingerprint) {
      return result;
    }
    if (approval.riskFingerprint !== tool.riskFingerprint) {
      return result;
    }
    if (!isToolReadOnly(tool, approval)) return result;

    result[tool.name] = {
      datasets: approval.datasets === true,
      ask: approval.ask === true,
      confirmedReadOnly: true,
      contractFingerprint: tool.contractFingerprint,
      riskFingerprint: tool.riskFingerprint,
      approvedAt: approval.approvedAt || new Date().toISOString(),
      approvedBy: approval.approvedBy || null,
    };
    return result;
  }, {});
}

function getApprovalReview(tools, requested = {}) {
  const currentToolNames = new Set(tools.map((tool) => tool.name));
  const changedTools = tools.reduce((result, tool) => {
    const approval = requested?.[tool.name];
    if (!approval) return result;
    if (tool.annotations?.destructiveHint === true) {
      result.push({ name: tool.name, reason: "not_available" });
    } else if (
      approval.contractFingerprint !== tool.contractFingerprint
      || approval.riskFingerprint !== tool.riskFingerprint
    ) {
      result.push({ name: tool.name, reason: "changed" });
    }
    return result;
  }, []);
  const removedTools = Object.keys(requested || {})
    .filter((name) => !currentToolNames.has(name))
    .sort();
  return { changedTools, removedTools };
}

function assertToolApproved(connection, tool, use) {
  const approval = connection?.schema?.mcp?.allowedTools?.[tool.name];
  if (!approval || approval[use] !== true) {
    throw createMcpError("MCP_TOOL_NOT_APPROVED", `The ${tool.title || tool.name} tool is not approved for ${use}.`, 403);
  }
  if (!isToolReadOnly(tool, approval)) {
    throw createMcpError("MCP_TOOL_NOT_READ_ONLY", "Only confirmed read-only MCP tools can run in Chartbrew.", 403);
  }
  if (
    approval.contractFingerprint !== tool.contractFingerprint
    || approval.riskFingerprint !== tool.riskFingerprint
  ) {
    throw createMcpError("MCP_TOOL_CHANGED", "This MCP tool changed after approval. Review the connection tools again.", 409);
  }
  return approval;
}

module.exports = {
  assertToolApproved,
  canonicalize,
  createMcpError,
  fingerprint,
  getApprovalReview,
  isToolReadOnly,
  mergeApprovals,
  normalizeAuthentication,
  normalizeCustomHeaders,
  normalizeEndpoint,
  sanitizeSchema,
  sanitizeMcpClientError,
  sanitizeTool,
  trimText,
};
