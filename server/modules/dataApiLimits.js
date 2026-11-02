const DEFAULT_DATA_API_LIMITS = Object.freeze({
  authRateLimitMax: 30,
  executionMs: 30000,
  maxFilters: 50,
  maxRequestBytes: 65536,
  maxResponseBytes: 5242880,
  maxStringBytes: 8192,
  maxValueDepth: 10,
  maxVariables: 100,
  rateLimitMax: 60,
});

const LIMIT_ENV = Object.freeze({
  authRateLimitMax: "CB_DATA_API_AUTH_RATE_LIMIT_MAX",
  executionMs: "CB_DATA_API_MAX_EXECUTION_MS",
  maxFilters: "CB_DATA_API_MAX_FILTERS",
  maxRequestBytes: "CB_DATA_API_MAX_REQUEST_BYTES",
  maxResponseBytes: "CB_DATA_API_MAX_RESPONSE_BYTES",
  maxStringBytes: "CB_DATA_API_MAX_STRING_BYTES",
  maxValueDepth: "CB_DATA_API_MAX_VALUE_DEPTH",
  maxVariables: "CB_DATA_API_MAX_VARIABLES",
  rateLimitMax: "CB_DATA_API_RATE_LIMIT_MAX",
});

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getDataApiLimits(environment = process.env) {
  return Object.entries(DEFAULT_DATA_API_LIMITS).reduce((limits, [key, fallback]) => {
    limits[key] = positiveInteger(environment[LIMIT_ENV[key]], fallback);
    return limits;
  }, {});
}

function withExecutionDeadline(operation, timeoutMs = getDataApiLimits().executionMs) {
  let timeout;
  const abortController = new AbortController();
  const deadlineAt = Date.now() + timeoutMs;
  const deadline = new Promise((_resolve, reject) => {
    timeout = setTimeout(() => {
      abortController.abort();
      const error = new Error("The request exceeded the execution time limit.");
      error.code = "EXECUTION_TIMEOUT";
      error.statusCode = 504;
      reject(error);
    }, timeoutMs);
    timeout.unref?.();
  });

  return Promise.race([
    Promise.resolve().then(() => operation({
      deadlineAt,
      signal: abortController.signal,
    })),
    deadline,
  ])
    .finally(() => clearTimeout(timeout));
}

module.exports = {
  DEFAULT_DATA_API_LIMITS,
  getDataApiLimits,
  positiveInteger,
  withExecutionDeadline,
};
