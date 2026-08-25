const { randomUUID } = require("crypto");

const { getDataApiLimits } = require("./dataApiLimits");

const ERROR_MESSAGES = Object.freeze({
  API_KEY_INVALID: "The API key is not valid.",
  API_KEY_REQUIRED: "A valid API key is required.",
  API_KEY_SCOPE_REQUIRED: "The API key does not have the required permission.",
  DATA_UNAVAILABLE: "The requested data is not available.",
  EXECUTION_TIMEOUT: "The request exceeded the execution time limit.",
  INTERNAL_ERROR: "The request could not be completed.",
  INVALID_FILTER: "One or more filters are not valid.",
  INVALID_REQUEST: "The request is not valid.",
  INVALID_VARIABLE: "One or more variables are not valid.",
  NOT_ACCEPTABLE: "This endpoint returns JSON.",
  RATE_LIMITED: "Too many requests were sent. Try again later.",
  REQUEST_TOO_LARGE: "The request body is too large.",
  RESOURCE_NOT_FOUND: "The requested resource was not found.",
  RESPONSE_TOO_LARGE: "The response is too large.",
  UNSUPPORTED_MEDIA_TYPE: "Use application/json for this request.",
});

const ERROR_STATUS = Object.freeze({
  API_KEY_INVALID: 401,
  API_KEY_REQUIRED: 401,
  API_KEY_SCOPE_REQUIRED: 403,
  DATA_UNAVAILABLE: 503,
  EXECUTION_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
  INVALID_FILTER: 400,
  INVALID_REQUEST: 400,
  INVALID_VARIABLE: 400,
  NOT_ACCEPTABLE: 406,
  RATE_LIMITED: 429,
  REQUEST_TOO_LARGE: 413,
  RESOURCE_NOT_FOUND: 404,
  RESPONSE_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
});

class DataApiError extends Error {
  constructor(code, options = {}) {
    super(ERROR_MESSAGES[code] || ERROR_MESSAGES.INTERNAL_ERROR);
    this.code = ERROR_MESSAGES[code] ? code : "INTERNAL_ERROR";
    this.statusCode = options.statusCode || ERROR_STATUS[this.code];
    this.cause = options.cause;
  }
}

function ensureRequestId(req) {
  if (!req.id) req.id = randomUUID();
  return req.id;
}

function errorBody(req, code) {
  const safeCode = ERROR_MESSAGES[code] ? code : "INTERNAL_ERROR";
  return {
    error: {
      code: safeCode,
      message: ERROR_MESSAGES[safeCode],
      requestId: ensureRequestId(req),
    },
  };
}

function sendDataApiError(req, res, error) {
  const code = ERROR_MESSAGES[error?.code] ? error.code : "INTERNAL_ERROR";
  const status = error?.statusCode || ERROR_STATUS[code];
  res.set("Cache-Control", "private, no-store");
  res.vary("Authorization");
  return res.status(status).json(errorBody(req, code));
}

function acceptsJson(req) {
  const accept = req.get?.("accept") || req.headers?.accept;
  if (!accept || accept === "*/*") return true;
  return accept.split(",").some((value) => {
    const [mediaType, ...parameters] = value.trim().split(";");
    const quality = parameters.find((parameter) => parameter.trim().startsWith("q="));
    if (quality && Number(quality.trim().slice(2)) === 0) return false;
    return mediaType === "*/*" || mediaType === "application/json" || mediaType.endsWith("+json");
  });
}

function matchesEtag(header, etag) {
  if (!header || !etag) return false;
  return header.split(",").map((value) => value.trim()).some((value) => {
    return value === "*" || value === etag || value.replace(/^W\//, "") === etag;
  });
}

function serializeDataApiResponse(value, options = {}) {
  const serialized = JSON.stringify(value);
  const bytes = Buffer.byteLength(serialized, "utf8");
  const maxBytes = options.maxBytes || getDataApiLimits().maxResponseBytes;
  if (bytes > maxBytes) throw new DataApiError("RESPONSE_TOO_LARGE");
  return { bytes, serialized };
}

function setDataHeaders(res, options = {}) {
  res.set("Cache-Control", options.cacheable ? "private, no-cache" : "private, no-store");
  res.vary("Authorization");
  res.set("X-Chartbrew-Data-Stale", options.stale ? "true" : "false");
  if (options.etag && options.cacheable) res.set("ETag", options.etag);
  if (options.generatedAt) {
    const date = new Date(options.generatedAt);
    if (!Number.isNaN(date.getTime())) res.set("Last-Modified", date.toUTCString());
  }
}

module.exports = {
  DataApiError,
  ERROR_MESSAGES,
  ERROR_STATUS,
  acceptsJson,
  ensureRequestId,
  errorBody,
  matchesEtag,
  sendDataApiError,
  serializeDataApiResponse,
  setDataHeaders,
};
