const { MCP_LIMITS } = require("./mcp.constants");
const { withMcpClient } = require("./mcp.client");
const {
  createMcpError,
  fingerprint,
  getApprovalReview,
  mergeApprovals,
  sanitizeTool,
  trimText,
} = require("./mcp.policy");
const { createMcpSafeFetch } = require("./mcp.safeFetch");

const SAFE_ICON_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function hasSafeImageSignature(contentType, body) {
  if (contentType === "image/png") {
    return body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (contentType === "image/jpeg") {
    return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  }
  if (contentType === "image/webp") {
    return body.length >= 12
      && body.subarray(0, 4).toString("ascii") === "RIFF"
      && body.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

async function loadServerIcon(serverInfo, endpoint, context = {}) {
  const icon = Array.isArray(serverInfo?.icons)
    ? serverInfo.icons.find((item) => item?.src)
    : null;
  if (!icon?.src) return "";

  let iconUrl;
  try {
    iconUrl = new URL(icon.src, endpoint);
  } catch (error) {
    return "";
  }
  if (iconUrl.origin !== new URL(endpoint).origin) return "";

  const safeFetch = createMcpSafeFetch({
    ...context,
    maxResponseBytes: MCP_LIMITS.iconBytes,
  });
  try {
    const response = await safeFetch.fetch(iconUrl.toString(), {
      headers: { accept: "image/png,image/jpeg,image/webp" },
    });
    const contentType = String(response.headers.get("content-type") || "")
      .split(";")[0].trim().toLowerCase();
    if (!response.ok || !SAFE_ICON_TYPES.has(contentType)) return "";
    const body = Buffer.from(await response.arrayBuffer());
    if (!body.length || body.length > MCP_LIMITS.iconBytes
      || !hasSafeImageSignature(contentType, body)) return "";
    return `data:${contentType};base64,${body.toString("base64")}`;
  } catch (error) {
    return "";
  } finally {
    await safeFetch.close();
  }
}

function sanitizeServer(serverInfo, endpoint, iconDataUri) {
  const endpointUrl = new URL(endpoint);
  let websiteUrl = "";
  try {
    const parsedWebsite = new URL(serverInfo?.websiteUrl || "");
    if (["http:", "https:"].includes(parsedWebsite.protocol)) {
      websiteUrl = parsedWebsite.toString();
    }
  } catch (error) {
    websiteUrl = "";
  }
  return {
    name: trimText(serverInfo?.title || serverInfo?.name, 256) || endpointUrl.hostname,
    technicalName: trimText(serverInfo?.name, 256),
    version: trimText(serverInfo?.version, 128),
    description: trimText(serverInfo?.description),
    websiteUrl: trimText(websiteUrl, 2000),
    icon: iconDataUri || "",
  };
}

function getCatalogCache(listResult, protocolEra) {
  const cacheScope = listResult?.cacheScope === "public" ? "public" : "private";
  const defaultTtl = protocolEra === "legacy" ? MCP_LIMITS.catalogLegacyTtlMs : 0;
  const requestedTtl = Number.isFinite(listResult?.ttlMs) ? Math.max(0, listResult.ttlMs) : defaultTtl;
  const maxTtl = cacheScope === "public"
    ? MCP_LIMITS.catalogPublicTtlMs
    : MCP_LIMITS.catalogPrivateTtlMs;
  const ttlMs = Math.min(requestedTtl, maxTtl);
  return {
    cacheScope,
    ttlMs,
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  };
}

async function discoverMcpConnection(connection, options = {}) {
  return withMcpClient(connection, async (client, session) => {
    const listResult = await client.listTools(undefined, { cacheMode: "refresh" });
    const rawTools = Array.isArray(listResult?.tools) ? listResult.tools : [];
    if (rawTools.length > MCP_LIMITS.maxTools) {
      throw createMcpError(
        "MCP_TOO_MANY_TOOLS",
        `This MCP server exposes more than ${MCP_LIMITS.maxTools} tools.`
      );
    }

    const tools = rawTools.map(sanitizeTool).sort((a, b) => a.name.localeCompare(b.name));
    const protocolEra = client.getProtocolEra() || "legacy";
    const serverInfo = client.getServerVersion() || {};
    const icon = options.loadIcon === false
      ? connection?.schema?.mcp?.server?.icon || ""
      : await loadServerIcon(serverInfo, session.endpoint, {
        teamId: connection?.team_id,
        connectionId: connection?.id,
      });
    const discovery = {
      server: sanitizeServer(serverInfo, session.endpoint, icon),
      protocolVersion: client.getNegotiatedProtocolVersion() || "",
      protocolEra,
      capabilities: {
        tools: Boolean(client.getServerCapabilities()?.tools),
      },
      instructions: trimText(client.getInstructions(), 4000),
      tools,
      catalogCache: getCatalogCache(listResult, protocolEra),
      discoveredAt: new Date().toISOString(),
    };
    discovery.catalogFingerprint = fingerprint({
      server: discovery.server,
      protocolVersion: discovery.protocolVersion,
      tools: tools.map((tool) => ({
        name: tool.name,
        contractFingerprint: tool.contractFingerprint,
        riskFingerprint: tool.riskFingerprint,
      })),
    });
    if (Buffer.byteLength(JSON.stringify(discovery)) > MCP_LIMITS.maxCatalogBytes) {
      throw createMcpError("MCP_CATALOG_TOO_LARGE", "The MCP tool catalog is too large to save.");
    }

    const requestedApprovals = options.allowedTools
      || connection?.schema?.mcp?.allowedTools
      || {};
    const approvalReview = getApprovalReview(tools, requestedApprovals);
    return {
      ...discovery,
      allowedTools: mergeApprovals(tools, requestedApprovals),
      reviewRequired: approvalReview.changedTools,
      removedTools: approvalReview.removedTools,
    };
  });
}

module.exports = {
  discoverMcpConnection,
  loadServerIcon,
};
