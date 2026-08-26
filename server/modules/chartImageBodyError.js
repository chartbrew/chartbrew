const { ChartImageError, sendImageError } = require("./chartImage/imageResponse");

const CHART_IMAGE_PATH = /^\/project\/[^/]+\/chart\/[^/]+\/image\/?(?:[?#]|$)/;

function isChartImageRequest(req) {
  return CHART_IMAGE_PATH.test(req.originalUrl || "");
}

function chartImageBodyError(error, req, res, next) {
  if (!isChartImageRequest(req)) return next(error);
  if (error?.type === "entity.too.large" || error?.status === 413) {
    return sendImageError(req, res, new ChartImageError("IMAGE_TOO_LARGE"));
  }
  if (error instanceof SyntaxError || error?.type === "entity.parse.failed") {
    return sendImageError(req, res, new ChartImageError("INVALID_IMAGE_OPTIONS"));
  }
  return next(error);
}

module.exports = chartImageBodyError;
module.exports.isChartImageRequest = isChartImageRequest;
