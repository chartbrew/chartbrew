const request = require("request-promise");

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

  while (true) { // eslint-disable-line no-constant-condition
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
    // eslint-disable-next-line no-await-in-loop
    await validateOutboundUrl(optionsForRequest.url, {
      ...policyContext,
      redirectCount,
    });

    // eslint-disable-next-line no-await-in-loop
    const response = await request(optionsForRequest);
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
