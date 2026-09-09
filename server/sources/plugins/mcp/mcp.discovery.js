const net = require("net");

const { MCP_LIMITS } = require("./mcp.constants");
const { withMcpClient } = require("./mcp.client");
const { selectTools } = require("./mcp.toolSelection");
const {
  createMcpError,
  fingerprint,
  getRemovedTools,
  mergeApprovals,
  sanitizeTool,
  trimText,
} = require("./mcp.policy");
const { createMcpSafeFetch } = require("./mcp.safeFetch");

const SAFE_ICON_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const ICON_FETCH_TIMEOUT_MS = 4000;
const SVG_UNSAFE_PATTERN = /<script[\s>]|on\w+\s*=|javascript:|data:text\/html|<foreignObject[\s>]/i;

function normalizeIconMime(value) {
  const mime = String(value || "").split(";")[0].trim().toLowerCase();
  if (mime === "image/jpg") return "image/jpeg";
  return mime;
}

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
  if (contentType === "image/svg+xml") {
    const text = body.subarray(0, Math.min(body.length, 512)).toString("utf8").trimStart();
    return text.startsWith("<svg") || (text.startsWith("<?xml") && /<svg[\s>]/i.test(text));
  }
  return false;
}

function sniffIconType(body, declaredType) {
  if (hasSafeImageSignature("image/png", body)) return "image/png";
  if (hasSafeImageSignature("image/jpeg", body)) return "image/jpeg";
  if (hasSafeImageSignature("image/webp", body)) return "image/webp";
  if (hasSafeImageSignature("image/svg+xml", body)) return "image/svg+xml";
  const declared = normalizeIconMime(declaredType);
  return SAFE_ICON_TYPES.has(declared) && hasSafeImageSignature(declared, body) ? declared : "";
}

function encodeIconDataUri(contentType, body) {
  if (!body?.length || body.length > MCP_LIMITS.iconBytes) return "";
  const type = sniffIconType(body, contentType);
  if (!type) return "";
  if (type === "image/svg+xml" && SVG_UNSAFE_PATTERN.test(body.toString("utf8"))) return "";
  return `data:${type};base64,${body.toString("base64")}`;
}

function loadDataUriIcon(src) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+=*)$/i.exec(String(src || "").trim());
  if (!match) return "";
  try {
    return encodeIconDataUri(match[1], Buffer.from(match[2], "base64"));
  } catch (error) {
    return "";
  }
}

function iconPreference(icon) {
  const mime = normalizeIconMime(icon?.mimeType);
  const src = String(icon?.src || "").toLowerCase();
  if (mime === "image/png" || src.includes(".png") || src.startsWith("data:image/png")) return 0;
  if (mime === "image/webp" || src.includes(".webp") || src.startsWith("data:image/webp")) return 1;
  if (mime === "image/jpeg" || src.includes(".jpg") || src.includes(".jpeg") || src.startsWith("data:image/jpeg")) {
    return 2;
  }
  if (mime === "image/svg+xml" || src.includes(".svg") || src.startsWith("data:image/svg")) return 3;
  return 4;
}

function selectPreferredIcon(icons) {
  return [...icons]
    .filter((icon) => icon?.src)
    .sort((left, right) => iconPreference(left) - iconPreference(right))[0] || null;
}

const WELL_KNOWN_ICON_PATHS = [
  "/apple-touch-icon.png",
  "/apple-touch-icon-precomposed.png",
  "/favicon.png",
  "/favicon.svg",
];
const ICON_HTML_BYTES = 256 * 1024;
const MAX_HTML_ICON_CANDIDATES = 6;

function addFallbackOrigin(origins, value, { allowIp = false } = {}) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return;
    if (!allowIp && net.isIP(url.hostname)) return;
    origins.add(url.origin);
    const host = url.hostname.toLowerCase();
    if (!net.isIP(host) && !host.startsWith("www.") && host.split(".").length === 2) {
      origins.add(`${url.protocol}//www.${host}`);
    }
  } catch (error) {
    // Ignore an invalid fallback origin.
  }
}

function getFallbackOrigins(serverInfo, endpoint) {
  const origins = new Set();
  if (serverInfo?.websiteUrl) addFallbackOrigin(origins, serverInfo.websiteUrl, { allowIp: true });
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    if (!net.isIP(host) && !host.startsWith("mcp.")) {
      addFallbackOrigin(origins, url.origin);
    }
    const labels = host.split(".");
    if (!net.isIP(host) && labels.length >= 3) {
      addFallbackOrigin(origins, `${url.protocol}//${labels.slice(1).join(".")}`);
    }
  } catch (error) {
    // Ignore an invalid MCP endpoint.
  }
  return [...origins];
}

function getFallbackIconUrls(serverInfo, endpoint) {
  return getFallbackOrigins(serverInfo, endpoint)
    .flatMap((origin) => WELL_KNOWN_ICON_PATHS.map((path) => `${origin}${path}`));
}

function getHtmlAttr(tag, name) {
  const match = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return match ? (match[1] || match[2] || match[3] || "") : "";
}

function extractIconUrlsFromHtml(html, baseUrl) {
  return [...String(html || "").matchAll(/<link\b[^>]*>/gi)]
    .map((match) => {
      const tag = match[0];
      const rel = getHtmlAttr(tag, "rel").toLowerCase();
      if (!/\b(icon|apple-touch-icon)\b/.test(rel)) return "";
      const href = getHtmlAttr(tag, "href");
      if (!href) return "";
      try {
        const iconUrl = new URL(href, baseUrl);
        return ["http:", "https:"].includes(iconUrl.protocol) ? iconUrl.toString() : "";
      } catch (error) {
        return "";
      }
    })
    .filter(Boolean);
}

async function fetchHttpIcon(iconUrl, context) {
  const safeFetch = createMcpSafeFetch({
    ...context,
    allowCrossOriginRedirect: true,
    maxResponseBytes: MCP_LIMITS.iconBytes,
  });
  try {
    const response = await safeFetch.fetch(iconUrl, {
      headers: { accept: "image/png,image/jpeg,image/webp,image/svg+xml" },
      signal: AbortSignal.timeout(ICON_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return "";
    const body = Buffer.from(await response.arrayBuffer());
    return encodeIconDataUri(response.headers.get("content-type"), body);
  } catch (error) {
    return "";
  } finally {
    await safeFetch.close();
  }
}

async function loadIconSrc(src, endpoint, context) {
  const value = String(src || "").trim();
  if (!value) return "";
  if (value.startsWith("data:")) return loadDataUriIcon(value);
  let iconUrl;
  try {
    iconUrl = new URL(value, endpoint);
  } catch (error) {
    return "";
  }
  if (!["http:", "https:"].includes(iconUrl.protocol)) return "";
  return fetchHttpIcon(iconUrl.toString(), context);
}

async function firstLoadedIcon(urls, endpoint, context, seen) {
  const candidates = [...new Set(urls.filter((url) => url && !seen.has(url)))];
  candidates.forEach((url) => seen.add(url));
  const loaded = await Promise.all(candidates.map((url) => loadIconSrc(url, endpoint, context)));
  return loaded.find(Boolean) || "";
}

async function loadHtmlIconUrls(pageUrl, context) {
  const safeFetch = createMcpSafeFetch({
    ...context,
    allowCrossOriginRedirect: true,
    maxResponseBytes: ICON_HTML_BYTES,
  });
  try {
    const response = await safeFetch.fetch(pageUrl, {
      headers: { accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(ICON_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return [];
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return [];
    }
    const html = Buffer.from(await response.arrayBuffer()).toString("utf8");
    return extractIconUrlsFromHtml(html, response.url || pageUrl)
      .sort((left, right) => iconPreference({ src: left }) - iconPreference({ src: right }))
      .slice(0, MAX_HTML_ICON_CANDIDATES);
  } catch (error) {
    return [];
  } finally {
    await safeFetch.close();
  }
}

async function loadServerIcon(serverInfo, endpoint, context = {}) {
  const advertised = Array.isArray(serverInfo?.icons) ? serverInfo.icons : [];
  const preferred = selectPreferredIcon(advertised);
  const advertisedSources = [...new Set([
    preferred?.src,
    ...advertised.map((icon) => icon?.src),
  ].filter(Boolean))];
  const seen = new Set();

  for (let index = 0; index < advertisedSources.length; index += 1) {
    const icon = await loadIconSrc(advertisedSources[index], endpoint, context); // oxlint-disable-line no-await-in-loop
    if (icon) return icon;
    seen.add(advertisedSources[index]);
  }

  const wellKnown = await firstLoadedIcon(
    getFallbackIconUrls(serverInfo, endpoint),
    endpoint,
    context,
    seen
  );
  if (wellKnown) return wellKnown;

  const htmlUrls = (await Promise.all(
    getFallbackOrigins(serverInfo, endpoint).map((origin) => loadHtmlIconUrls(`${origin}/`, context))
  )).flat();
  return firstLoadedIcon(htmlUrls, endpoint, context, seen);
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

function sanitizeResource(resource) {
  if (!resource?.uri) return null;
  return {
    uri: trimText(resource.uri, 2000),
    name: trimText(resource.name || resource.title || resource.uri, 256),
    description: trimText(resource.description || "", 1000),
    mimeType: trimText(resource.mimeType || "", 128),
  };
}

async function listContextResources(client) {
  if (!client.getServerCapabilities()?.resources) return [];
  try {
    const result = await client.listResources(undefined, { cacheMode: "refresh" });
    const resources = (Array.isArray(result?.resources) ? result.resources : [])
      .map(sanitizeResource)
      .filter(Boolean);
    return resources.slice(0, MCP_LIMITS.maxResources);
  } catch (error) {
    return [];
  }
}

async function discoverMcpConnection(connection, options = {}) {
  return withMcpClient(connection, async (client, session) => {
    const listResult = await client.listTools(undefined, { cacheMode: "refresh" });
    const rawTools = Array.isArray(listResult?.tools) ? listResult.tools : [];
    const requestedApprovals = options.allowedTools || connection?.schema?.mcp?.allowedTools || {};
    const selectedTools = selectTools(rawTools, {
      question: connection.options?.mcp?.toolQuery,
      allowedTools: requestedApprovals,
    });
    const tools = [];
    selectedTools.forEach((tool) => {
      try {
        tools.push(sanitizeTool(tool));
      } catch (error) {
        // Reject this tool, not the other tools in the connection. Execution still validates each tool.
        if (!["MCP_SCHEMA_TOO_LARGE", "MCP_SCHEMA_TOO_DEEP", "MCP_EXTERNAL_SCHEMA_REFERENCE", "MCP_INVALID_TOOL"].includes(error.code)) {
          throw error;
        }
      }
    });
    if (selectedTools.length && !tools.length) {
      throw createMcpError("MCP_NO_USABLE_TOOLS", "Chartbrew cannot use the tools returned by this server. Choose different tools on the server and load them again.");
    }
    tools.sort((a, b) => a.name.localeCompare(b.name));
    const resources = await listContextResources(client);
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
        resources: Boolean(client.getServerCapabilities()?.resources),
      },
      instructions: trimText(client.getInstructions(), 4000),
      resources,
      tools,
      omittedToolCount: rawTools.length - selectedTools.length,
      unsupportedToolCount: selectedTools.length - tools.length,
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
      resources: resources.map((resource) => ({
        uri: resource.uri,
        name: resource.name,
      })),
    });
    if (Buffer.byteLength(JSON.stringify(discovery)) > MCP_LIMITS.maxCatalogBytes) {
      throw createMcpError("MCP_CATALOG_TOO_LARGE", "The MCP tool catalog is too large to save.");
    }

    return {
      ...discovery,
      allowedTools: mergeApprovals(tools, requestedApprovals),
      removedTools: getRemovedTools(tools, requestedApprovals),
    };
  }, { discoverTools: true });
}

module.exports = {
  discoverMcpConnection,
  loadServerIcon,
};
