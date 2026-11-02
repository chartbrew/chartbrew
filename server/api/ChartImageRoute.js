const rateLimit = require("express-rate-limit");

const ChartImageController = require("../controllers/ChartImageController");
const { validateImageUserToken } = require("../modules/chartImage/imageAuthentication");
const { IMAGE_RENDER_LIMITS } = require("../modules/chartImage/imageLimits");
const {
  ChartImageError,
  ensureImageRequestId,
  sendImageError,
  sendImagePng,
} = require("../modules/chartImage/imageResponse");
const verifyToken = require("../modules/verifyToken");

function requestId(req, _res, next) {
  ensureImageRequestId(req);
  return next();
}

function validateImageHttpRequest(req, res, next) {
  if (!req.is("application/json")) {
    return sendImageError(req, res, new ChartImageError("INVALID_IMAGE_OPTIONS"));
  }
  const rawBytes = Buffer.byteLength(req.rawBody || JSON.stringify(req.body || {}), "utf8");
  if (rawBytes > IMAGE_RENDER_LIMITS.bodyBytes) {
    return sendImageError(req, res, new ChartImageError("IMAGE_TOO_LARGE"));
  }
  return next();
}

function sendAuthenticationError(req, res) {
  return sendImageError(req, res, new ChartImageError("AUTHENTICATION_REQUIRED"));
}

function createImageRateLimiter() {
  return rateLimit({
    keyGenerator: (req) => `${req.user.id}`,
    legacyHeaders: false,
    limit: IMAGE_RENDER_LIMITS.maxRequestsPerMinute,
    standardHeaders: true,
    windowMs: 60 * 1000,
    handler: (req, res) => {
      return sendImageError(req, res, new ChartImageError("IMAGE_RATE_LIMITED"));
    },
  });
}

module.exports = (app, options = {}) => {
  const controller = options.controller || new ChartImageController(options);
  const limiter = options.rateLimiter || createImageRateLimiter();
  const authenticate = verifyToken.withErrorHandler(sendAuthenticationError, {
    validateToken: options.validateToken || validateImageUserToken,
  });

  app.post(
    "/project/:project_id/chart/:chart_id/image",
    requestId,
    authenticate,
    limiter,
    validateImageHttpRequest,
    async (req, res) => {
      const abortController = new AbortController();
      const abort = () => abortController.abort();
      req.once("aborted", abort);
      res.once("close", () => {
        if (!res.writableEnded) abort();
      });
      try {
        const png = await controller.render(req, { signal: abortController.signal });
        return sendImagePng(req, res, png);
      } catch (error) {
        if (res.headersSent || res.destroyed) return undefined;
        return sendImageError(req, res, error);
      } finally {
        req.removeListener("aborted", abort);
      }
    }
  );

  return (req, res, next) => next();
};

module.exports.createImageRateLimiter = createImageRateLimiter;
module.exports.validateImageHttpRequest = validateImageHttpRequest;
