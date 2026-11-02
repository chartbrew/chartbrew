const { Agent, request } = require("undici");
const qs = require("qs");
const net = require("net");

const { validateOutboundUrl } = require("./outboundTargetPolicy");
const { sanitizeOutboundRequestOptions } = require("./sanitizeOutboundRequestOptions");

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_MAX_REDIRECTS = 10;

function normalizeMethod(method) {
  return String(method || "GET").toUpperCase();
}

function shouldFollowRedirect({
  statusCode,
  method,
  followRedirect,
  followAllRedirects,
}) {
  if (!followRedirect || !REDIRECT_STATUS_CODES.has(statusCode)) return false;
  if (statusCode === 303) return true;
  if (followAllRedirects) return true;

  const normalizedMethod = normalizeMethod(method);
  return normalizedMethod === "GET" || normalizedMethod === "HEAD";
}

function shouldRewriteMethodForRedirect(statusCode, method) {
  const normalizedMethod = normalizeMethod(method);
  if (normalizedMethod === "HEAD") return false;

  if (statusCode === 303) return true;
  if ((statusCode === 301 || statusCode === 302) && normalizedMethod === "POST") {
    return true;
  }

  return false;
}

function normalizeHostname(hostname) {
  return String(hostname || "")
    .trim()
    .replace(/\.$/, "")
    .toLowerCase();
}

function createLookupError(hostname) {
  const error = new Error(`Validated DNS resolution not available for ${hostname}.`);
  error.code = "ENOTFOUND";
  error.hostname = hostname;
  return error;
}

function createPinnedLookup(expectedHostname, resolvedAddresses = []) {
  const normalizedExpectedHostname = normalizeHostname(expectedHostname);
  const candidates = resolvedAddresses
    .map((address) => ({
      address,
      family: net.isIP(address),
    }))
    .filter((entry) => entry.family);

  return (hostname, options, callback) => {
    const lookupOptions = typeof options === "function" ? {} : options || {};
    const cb = typeof options === "function" ? options : callback;
    const normalizedHostname = normalizeHostname(hostname);

    if (!cb) return;

    if (normalizedHostname !== normalizedExpectedHostname) {
      process.nextTick(() => cb(createLookupError(hostname)));
      return;
    }

    const requestedFamily = Number(lookupOptions.family) || 0;
    const matches = requestedFamily
      ? candidates.filter((entry) => entry.family === requestedFamily)
      : candidates;

    if (matches.length === 0) {
      process.nextTick(() => cb(createLookupError(hostname)));
      return;
    }

    process.nextTick(() => {
      if (lookupOptions.all) {
        cb(null, matches.map((entry) => ({ ...entry })));
        return;
      }

      cb(null, matches[0].address, matches[0].family);
    });
  };
}

async function requestWithResponseLimit(options, validation, signal) {
  const dispatcher = new Agent({
    connect: {
      lookup: createPinnedLookup(validation.hostname, validation.resolvedAddresses),
      timeout: options.timeout > 0 ? options.timeout : 10000,
    },
  });
  const limit = options.maximumResponseBytes;
  const hasLimit = Number.isInteger(limit) && limit > 0;

  try {
    const response = await request(options.url, {
      dispatcher,
      method: normalizeMethod(options.method),
      headers: options.headers,
      body: options.body,
      signal,
      maxRedirections: 0,
    });
    if (hasLimit && Number(response.headers["content-length"]) > limit) {
      const error = new Error("Outbound response exceeded the allowed size.");
      error.code = "RESPONSE_TOO_LARGE";
      throw error;
    }

    const chunks = [];
    let receivedBytes = 0;
    for await (const chunk of response.body) {
      receivedBytes += chunk.length;
      if (hasLimit && receivedBytes > limit) {
        const error = new Error("Outbound response exceeded the allowed size.");
        error.code = "RESPONSE_TOO_LARGE";
        throw error;
      }
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks, receivedBytes);
    return {
      statusCode: response.statusCode,
      headers: response.headers,
      body: options.encoding === null ? buffer : buffer.toString(options.encoding || "utf8"),
    };
  } catch (error) {
    if (signal?.aborted && signal.reason?.name === "TimeoutError") {
      const timeoutError = new Error("Outbound request timed out.");
      timeoutError.code = "ETIMEDOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    await dispatcher.destroy();
  }
}

async function safeRequest(requestOptions, policyContext = {}) {
  const baseOptions = { ...requestOptions };
  const followRedirect = baseOptions.followRedirect !== false;
  const followAllRedirects = baseOptions.followAllRedirects === true;
  const maxRedirects = Number.isInteger(baseOptions.maxRedirects)
    ? baseOptions.maxRedirects
    : DEFAULT_MAX_REDIRECTS;

  let redirectCount = 0;
  const initialOptions = sanitizeOutboundRequestOptions(baseOptions);
  const url = new URL(initialOptions.url);
  if (baseOptions.qs) {
    url.search = qs.stringify({ ...qs.parse(url.search.slice(1)), ...baseOptions.qs });
  }
  const headers = Object.fromEntries(Object.entries(initialOptions.headers || {})
    .map(([name, value]) => [name.toLowerCase(), value]));
  if ((url.username || url.password) && !headers.authorization) {
    const credentials = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`;
    headers.authorization = `Basic ${Buffer.from(credentials).toString("base64")}`;
  }
  url.username = "";
  url.password = "";
  if (baseOptions.auth?.bearer) {
    headers.authorization = `Bearer ${baseOptions.auth.bearer}`;
  } else if (baseOptions.auth) {
    const credentials = `${baseOptions.auth.user || ""}:${baseOptions.auth.pass || ""}`;
    headers.authorization = `Basic ${Buffer.from(credentials).toString("base64")}`;
  }
  if (baseOptions.json && !headers.accept) headers.accept = "application/json";
  let currentBody = baseOptions.body;
  if (baseOptions.form) {
    currentBody = qs.stringify(baseOptions.form).replace(/%20/g, "+");
    headers["content-type"] ||= "application/x-www-form-urlencoded";
  } else if (baseOptions.json && currentBody !== undefined) {
    if (!Buffer.isBuffer(currentBody) && typeof currentBody !== "string") {
      currentBody = JSON.stringify(currentBody);
    }
    headers["content-type"] ||= "application/json";
  }
  const signal = baseOptions.timeout > 0 ? AbortSignal.timeout(baseOptions.timeout) : undefined;
  let currentUrl = url.toString();
  let currentMethod = normalizeMethod(baseOptions.method);

  while (true) { // oxlint-disable-line no-constant-condition
    const optionsForRequest = sanitizeOutboundRequestOptions(
      {
        ...baseOptions,
        url: currentUrl,
        method: currentMethod,
        body: currentBody,
        headers,
      },
      currentUrl
    );

    // Redirect validation must run sequentially to validate each hop in order.
    // oxlint-disable-next-line no-await-in-loop
    const validationResult = await validateOutboundUrl(optionsForRequest.url, {
      ...policyContext,
      redirectCount,
    });

    // oxlint-disable-next-line no-await-in-loop
    const response = await requestWithResponseLimit(optionsForRequest, validationResult, signal);
    const statusCode = response && response.statusCode;
    const location = response && response.headers && response.headers.location;

    if (!location || !shouldFollowRedirect({
      statusCode,
      method: currentMethod,
      followRedirect,
      followAllRedirects,
    })) {
      if (baseOptions.json && typeof response.body === "string") {
        try {
          response.body = JSON.parse(response.body);
        } catch {
          // Some sources return plain text even when JSON was requested.
        }
      }
      if (baseOptions.simple !== false && (statusCode < 200 || statusCode >= 300)) {
        const error = new Error(`Outbound request returned HTTP ${statusCode}.`);
        error.statusCode = statusCode;
        error.error = response.body;
        error.response = response;
        throw error;
      }
      return baseOptions.resolveWithFullResponse ? response : response.body;
    }

    if (redirectCount >= maxRedirects) {
      const redirectError = new Error("Exceeded maximum redirect limit for outbound request.");
      redirectError.code = "TOO_MANY_REDIRECTS";
      throw redirectError;
    }

    redirectCount += 1;
    const nextUrl = new URL(location, optionsForRequest.url);
    if (nextUrl.origin !== new URL(currentUrl).origin) {
      delete headers.authorization;
      delete headers.cookie;
      delete headers["proxy-authorization"];
    }
    currentUrl = nextUrl.toString();

    if (shouldRewriteMethodForRedirect(statusCode, currentMethod)) {
      currentMethod = "GET";
      currentBody = undefined;
      delete headers["content-type"];
      delete headers["content-length"];
    }
  }
}

module.exports = safeRequest;
