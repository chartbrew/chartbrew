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

async function readBoundedResponseText(response, limit) {
  try {
    const clone = response.clone();
    if (!clone.body) {
      return String(await clone.text().catch(() => "")).slice(0, limit);
    }
    const reader = clone.body.getReader();
    const chunks = [];
    let bytes = 0;
    let finished = false;
    while (bytes < limit) {
      const result = await reader.read(); // oxlint-disable-line no-await-in-loop
      if (result.done || !result.value) {
        finished = true;
        break;
      }
      chunks.push(result.value);
      bytes += result.value.byteLength;
    }
    if (!finished) {
      // A cloned stream can wait for the original stream when it is cancelled.
      // The caller must receive the original response before that can happen.
      reader.cancel().catch(() => {});
    }
    if (!chunks.length) return "";
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
      .subarray(0, limit)
      .toString("utf8");
  } catch (error) {
    return "";
  }
}

async function captureHttpError(response) {
  return {
    status: response.status,
    statusText: String(response.statusText || ""),
    text: await readBoundedResponseText(response, MCP_LIMITS.errorDetailsCharacters),
    wwwAuthenticate: String(response.headers.get("www-authenticate") || "")
      .slice(0, MCP_LIMITS.errorDetailsCharacters),
  };
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
  let lastHttpError = null;

  const safeFetch = async (input, init = {}) => {
    lastHttpError = null;
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
      if (!context.allowCrossOriginRedirect && currentUrl.origin !== originalOrigin) {
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
        if (!response.ok) {
          lastHttpError = await captureHttpError(response); // oxlint-disable-line no-await-in-loop
        }
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

  return {
    close,
    fetch: safeFetch,
    getLastHttpError: () => lastHttpError,
  };
}

module.exports = {
  createMcpSafeFetch,
};
