const rateLimit = require("express-rate-limit");

const DataApiController = require("../controllers/DataApiController");
const verifyDataApiKey = require("../modules/verifyDataApiKey");
const { getDataApiLimits } = require("../modules/dataApiLimits");
const { incrementDataApiMetric } = require("../modules/dataApiMetrics");
const {
  DataApiError,
  acceptsJson,
  ensureRequestId,
  sendDataApiError,
  setDataHeaders,
} = require("../modules/dataApiResponse");
const { failRun, startRun } = require("../modules/updateAudit");

function isDataApiEnabled() {
  return process.env.CB_DATA_API_ENABLED !== "false";
}

function requestId(req, _res, next) {
  ensureRequestId(req);
  return next();
}

function requireEnabled(req, res, next) {
  if (!isDataApiEnabled()) return sendDataApiError(req, res, new DataApiError("RESOURCE_NOT_FOUND"));
  return next();
}

function validateHttpRequest(req, res, next) {
  if (!acceptsJson(req)) return sendDataApiError(req, res, new DataApiError("NOT_ACCEPTABLE"));
  if (req.method === "GET" && Object.keys(req.query || {}).length > 0) {
    return sendDataApiError(req, res, new DataApiError("INVALID_REQUEST"));
  }
  if (req.method === "POST") {
    if (!req.is("application/json")) {
      return sendDataApiError(req, res, new DataApiError("UNSUPPORTED_MEDIA_TYPE"));
    }
    const rawBytes = Buffer.byteLength(req.rawBody || JSON.stringify(req.body || {}), "utf8");
    if (rawBytes > getDataApiLimits().maxRequestBytes) {
      incrementDataApiMetric("size_rejections", { resourceType: "request", type: "REQUEST_TOO_LARGE" });
      return sendDataApiError(req, res, new DataApiError("REQUEST_TOO_LARGE"));
    }
  }
  return next();
}

function createAuthLimiter() {
  return rateLimit({
    legacyHeaders: false,
    limit: () => getDataApiLimits().authRateLimitMax,
    standardHeaders: true,
    windowMs: 60 * 1000,
    requestWasSuccessful: (req) => Boolean(req.apiKeyAccess),
    skipSuccessfulRequests: true,
    handler: (req, res) => {
      incrementDataApiMetric("authorization_failures", { code: "RATE_LIMITED" });
      return sendDataApiError(req, res, new DataApiError("RATE_LIMITED"));
    },
  });
}

function positiveAuditId(value) {
  if (!/^[1-9]\d*$/.test(`${value || ""}`)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function auditAuthenticatedRateLimit(req) {
  const isChart = Boolean(req.params.chart_id);
  const traceContext = await startRun({
    triggerType: "data_api",
    entityType: isChart ? "chart_data" : "dataset_data",
    status: "running",
    apiKeyId: req.apiKeyAccess.apiKeyId,
    teamId: req.apiKeyAccess.teamId,
    projectId: positiveAuditId(req.params.project_id),
    chartId: positiveAuditId(req.params.chart_id),
    datasetId: positiveAuditId(req.params.dataset_id),
    summary: {
      apiVersion: "v1",
      method: req.method,
      requestId: req.id,
    },
  });
  await failRun(traceContext, new DataApiError("RATE_LIMITED"), {
    stage: "data_api",
    summary: {
      apiVersion: "v1",
      errorCode: "RATE_LIMITED",
      method: req.method,
      requestId: req.id,
      responseBytes: 0,
      statusCode: 429,
    },
  });
}

function createKeyLimiter() {
  return rateLimit({
    keyGenerator: (req) => req.apiKeyAccess.apiKeyId,
    legacyHeaders: false,
    limit: () => getDataApiLimits().rateLimitMax,
    standardHeaders: true,
    windowMs: 60 * 1000,
    handler: async (req, res) => {
      incrementDataApiMetric("requests", { resourceType: "rate_limit", statusCode: 429 });
      await auditAuthenticatedRateLimit(req);
      return sendDataApiError(req, res, new DataApiError("RATE_LIMITED"));
    },
  });
}

function sendResult(res, result) {
  setDataHeaders(res, result);
  if (result.notModified) return res.status(304).end();
  res.status(200).set("Content-Type", "application/json; charset=utf-8");
  return res.end(result.serialized);
}

function routeHandler(controllerMethod) {
  return async (req, res) => {
    try {
      return sendResult(res, await controllerMethod(req));
    } catch (error) {
      return sendDataApiError(req, res, error);
    }
  };
}

module.exports = (app) => {
  const controller = new DataApiController();
  const authLimiter = createAuthLimiter();
  const keyLimiter = createKeyLimiter();
  const access = [requestId, requireEnabled, validateHttpRequest, authLimiter, verifyDataApiKey(), keyLimiter];

  app.get(
    "/api/v1/teams/:team_id/datasets/:dataset_id/data",
    ...access,
    routeHandler(controller.datasetData.bind(controller))
  );
  app.post(
    "/api/v1/teams/:team_id/datasets/:dataset_id/data",
    ...access,
    routeHandler(controller.datasetData.bind(controller))
  );
  app.get(
    "/api/v1/projects/:project_id/charts/:chart_id/data",
    ...access,
    routeHandler(controller.chartData.bind(controller))
  );
  app.post(
    "/api/v1/projects/:project_id/charts/:chart_id/data",
    ...access,
    routeHandler(controller.chartData.bind(controller))
  );

  return (req, res, next) => next();
};
