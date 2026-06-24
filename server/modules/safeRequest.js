const request = require("request-promise");
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

async function safeRequest(requestOptions, policyContext = {}) {
  const baseOptions = { ...requestOptions };
  const followRedirect = baseOptions.followRedirect !== false;
  const followAllRedirects = baseOptions.followAllRedirects === true;
  const maxRedirects = Number.isInteger(baseOptions.maxRedirects)
    ? baseOptions.maxRedirects
    : DEFAULT_MAX_REDIRECTS;

  let redirectCount = 0;
  let currentUrl = baseOptions.url;
  let currentMethod = baseOptions.method || "GET";
  let currentBody = baseOptions.body;
  let currentForm = baseOptions.form;
  let currentFormData = baseOptions.formData;

  while (true) { // oxlint-disable-line no-constant-condition
    const optionsForRequest = sanitizeOutboundRequestOptions(
      {
        ...baseOptions,
        url: currentUrl,
        method: currentMethod,
        body: currentBody,
        form: currentForm,
        formData: currentFormData,
        followRedirect: false,
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
    const response = await request({
      ...optionsForRequest,
      lookup: createPinnedLookup(
        validationResult.hostname,
        validationResult.resolvedAddresses
      ),
    });
    const statusCode = response && response.statusCode;
    const location = response && response.headers && response.headers.location;

    if (!location || !shouldFollowRedirect({
      statusCode,
      method: currentMethod,
      followRedirect,
      followAllRedirects,
    })) {
      return response;
    }

    if (redirectCount >= maxRedirects) {
      const redirectError = new Error("Exceeded maximum redirect limit for outbound request.");
      redirectError.code = "TOO_MANY_REDIRECTS";
      throw redirectError;
    }

    redirectCount += 1;
    currentUrl = new URL(location, optionsForRequest.url).toString();

    if (shouldRewriteMethodForRedirect(statusCode, currentMethod)) {
      currentMethod = "GET";
      currentBody = undefined;
      currentForm = undefined;
      currentFormData = undefined;
    }
  }
}

module.exports = safeRequest;
