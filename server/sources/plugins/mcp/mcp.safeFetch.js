const net = require("net");
const { Agent, fetch: undiciFetch } = require("undici");

const { validateOutboundUrl } = require("../../../modules/outboundTargetPolicy");
const { MCP_LIMITS } = require("./mcp.constants");
const { createMcpError } = require("./mcp.policy");

function getRequestUrl(input) {
  if (typeof input === "string" || input instanceof URL) return String(input);
  return input?.url || String(input);
}

function getPinnedAgent(validation, agents) {
  if (!validation.resolvedAddresses.length) {
    throw createMcpError("MCP_DNS_FAILED", "The MCP server hostname could not be resolved.");
  }

  const key = `${validation.hostname}:${validation.resolvedAddresses.join(",")}`;
  if (agents.has(key)) return agents.get(key);

  let nextAddress = 0;
  const lookup = (hostname, options, callback) => {
    if (String(hostname).toLowerCase().replace(/\.$/, "") !== validation.hostname) {
      callback(createMcpError("MCP_DNS_CHANGED", "The MCP request hostname changed unexpectedly."));
      return;
    }

    const entries = validation.resolvedAddresses.map((address) => ({
      address,
      family: net.isIP(address),
    }));
    if (options?.all) {
      callback(null, entries);
      return;
    }

    const entry = entries[nextAddress % entries.length];
    nextAddress += 1;
    callback(null, entry.address, entry.family);
  };
  const agent = new Agent({ connect: { lookup } });
  agents.set(key, agent);
  return agent;
}

function wrapLimitedResponse(response, limit) {
  if (!response.body) return response;

  let bytes = 0;
  const transform = new TransformStream({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > limit) {
        controller.error(createMcpError(
          "MCP_RESPONSE_TOO_LARGE",
          "The MCP server response is too large."
        ));
        return;
      }
      controller.enqueue(chunk);
    },
  });
  const wrapped = new Response(response.body.pipeThrough(transform), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
  Object.defineProperties(wrapped, {
    url: { value: response.url },
    redirected: { value: response.redirected },
  });
  return wrapped;
}

function getRedirectMethod(method, status) {
  if (status === 303 && method !== "HEAD") return "GET";
  if ((status === 301 || status === 302) && method === "POST") return "GET";
  return method;
}

function createMcpSafeFetch(context = {}) {
  const agents = new Map();

  const safeFetch = async (input, init = {}) => {
    let targetUrl = getRequestUrl(input);
    let requestInit = { ...init };
    const originalOrigin = new URL(targetUrl).origin;

    for (let redirectCount = 0; redirectCount <= MCP_LIMITS.maxRedirects; redirectCount += 1) {
      // Redirect checks must run in order because each target comes from the prior response.
      const validation = await validateOutboundUrl(targetUrl, { // oxlint-disable-line no-await-in-loop
        source: "mcp",
        teamId: context.teamId,
        connectionId: context.connectionId,
        userId: context.userId,
        allowPrivateHost: context.allowPrivateHost,
      });
      const currentUrl = new URL(validation.url);
      if (currentUrl.origin !== originalOrigin) {
        throw createMcpError(
          "MCP_CROSS_ORIGIN_REDIRECT",
          "The MCP server redirected to a different site."
        );
      }

      const response = await undiciFetch(validation.url, { // oxlint-disable-line no-await-in-loop
        ...requestInit,
        dispatcher: getPinnedAgent(validation, agents),
        redirect: "manual",
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) {
        return wrapLimitedResponse(response, context.maxResponseBytes || MCP_LIMITS.maxResponseBytes);
      }

      if (redirectCount === MCP_LIMITS.maxRedirects) {
        await response.body?.cancel(); // oxlint-disable-line no-await-in-loop
        throw createMcpError("MCP_TOO_MANY_REDIRECTS", "The MCP server redirected too many times.");
      }
      const location = response.headers.get("location");
      await response.body?.cancel(); // oxlint-disable-line no-await-in-loop
      if (!location) {
        throw createMcpError("MCP_INVALID_REDIRECT", "The MCP server returned an invalid redirect.");
      }

      targetUrl = new URL(location, validation.url).toString();
      const nextMethod = getRedirectMethod(String(requestInit.method || "GET").toUpperCase(), response.status);
      requestInit = {
        ...requestInit,
        method: nextMethod,
        body: nextMethod === "GET" ? undefined : requestInit.body,
      };
    }

    throw createMcpError("MCP_TOO_MANY_REDIRECTS", "The MCP server redirected too many times.");
  };

  const close = async () => {
    await Promise.all([...agents.values()].map((agent) => agent.close().catch(() => null)));
    agents.clear();
  };

  return { close, fetch: safeFetch };
}

module.exports = {
  createMcpSafeFetch,
};
