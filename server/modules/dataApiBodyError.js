const { DataApiError, sendDataApiError } = require("./dataApiResponse");

function isDataApiRequest(req) {
  return req.originalUrl?.startsWith("/api/v1/");
}

function dataApiBodyError(error, req, res, next) {
  if (!isDataApiRequest(req)) return next(error);
  if (error?.type === "entity.too.large" || error?.status === 413) {
    return sendDataApiError(req, res, new DataApiError("REQUEST_TOO_LARGE"));
  }
  if (error instanceof SyntaxError || error?.type === "entity.parse.failed") {
    return sendDataApiError(req, res, new DataApiError("INVALID_REQUEST"));
  }
  return next(error);
}

module.exports = dataApiBodyError;
