const { randomUUID } = require("crypto");

const IMAGE_ERROR_DEFINITIONS = Object.freeze({
  AUTHENTICATION_REQUIRED: {
    message: "Authentication is required.",
    statusCode: 401,
  },
  IMAGE_DATA_UNAVAILABLE: {
    message: "The chart data is not ready. Refresh the chart and try again.",
    statusCode: 503,
  },
  IMAGE_EXPORT_FORBIDDEN: {
    message: "You do not have permission to export this chart.",
    statusCode: 403,
  },
  IMAGE_PRESET_UNSUPPORTED: {
    message: "This chart type cannot be exported as an image.",
    statusCode: 409,
  },
  IMAGE_RATE_LIMITED: {
    message: "Too many image requests were sent. Try again later.",
    statusCode: 429,
  },
  IMAGE_RENDER_BUSY: {
    message: "The image renderer is busy. Try again shortly.",
    statusCode: 503,
  },
  IMAGE_RENDER_FAILED: {
    message: "The image could not be created.",
    statusCode: 500,
  },
  IMAGE_RENDER_TIMEOUT: {
    message: "The image took too long to create.",
    statusCode: 504,
  },
  IMAGE_TOO_LARGE: {
    message: "The requested image is too large.",
    statusCode: 413,
  },
  INVALID_IMAGE_OPTIONS: {
    message: "One or more image options are not valid.",
    statusCode: 400,
  },
  RESOURCE_NOT_FOUND: {
    message: "The requested resource was not found.",
    statusCode: 404,
  },
});

class ChartImageError extends Error {
  constructor(code, options = {}) {
    const definition = IMAGE_ERROR_DEFINITIONS[code] || IMAGE_ERROR_DEFINITIONS.IMAGE_RENDER_FAILED;
    super(definition.message);
    this.code = IMAGE_ERROR_DEFINITIONS[code] ? code : "IMAGE_RENDER_FAILED";
    this.statusCode = definition.statusCode;
    this.cause = options.cause;
  }
}

function ensureImageRequestId(req) {
  if (!req.id) req.id = randomUUID();
  return req.id;
}

function publicImageError(error) {
  if (error instanceof ChartImageError) return error;
  if (IMAGE_ERROR_DEFINITIONS[error?.code]) return new ChartImageError(error.code);
  if (["IMAGE_RENDER_BUSY", "IMAGE_RENDER_CLOSED"].includes(error?.code)) {
    return new ChartImageError("IMAGE_RENDER_BUSY");
  }
  return new ChartImageError("IMAGE_RENDER_FAILED", { cause: error });
}

function setPrivateImageHeaders(req, res) {
  const requestId = ensureImageRequestId(req);
  res.set("Cache-Control", "private, no-store");
  res.set("X-Request-Id", requestId);
  return requestId;
}

function sendImageError(req, res, error) {
  const safeError = publicImageError(error);
  const requestId = setPrivateImageHeaders(req, res);
  return res.status(safeError.statusCode).json({
    error: {
      code: safeError.code,
      message: safeError.message,
      requestId,
    },
  });
}

function sendImagePng(req, res, png) {
  setPrivateImageHeaders(req, res);
  res.status(200).type("png");
  return res.end(png);
}

module.exports = {
  ChartImageError,
  IMAGE_ERROR_DEFINITIONS,
  ensureImageRequestId,
  publicImageError,
  sendImageError,
  sendImagePng,
  setPrivateImageHeaders,
};
