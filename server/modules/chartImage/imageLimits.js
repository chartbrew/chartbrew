const IMAGE_RENDER_LIMITS = Object.freeze({
  bodyBytes: 16 * 1024,
  maxDimension: 2400,
  maxPixels: 5_760_000,
  maxPngBytes: 12 * 1024 * 1024,
  maxPreparedRows: 20_000,
  maxQueueLength: 40,
  maxSvgBytes: 8 * 1024 * 1024,
  queueWaitMs: 5000,
  renderTimeoutMs: 5000,
});

function countPreparedRows(preparedData) {
  return (preparedData?.results || []).reduce((total, result) => {
    return total + (Array.isArray(result.rows) ? result.rows.length : 0);
  }, 0);
}

function assertImageDimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Image dimensions must be positive integers");
  }
  if (width > IMAGE_RENDER_LIMITS.maxDimension || height > IMAGE_RENDER_LIMITS.maxDimension) {
    throw new Error("Image dimensions exceed the maximum size");
  }
  if ((width * height) > IMAGE_RENDER_LIMITS.maxPixels) {
    throw new Error("Image pixel count exceeds the maximum size");
  }
}

function assertPreparedRows(preparedData) {
  const rows = countPreparedRows(preparedData);
  if (rows > IMAGE_RENDER_LIMITS.maxPreparedRows) {
    throw new Error("Prepared data exceeds the image row limit");
  }
  return rows;
}

module.exports = {
  IMAGE_RENDER_LIMITS,
  assertImageDimensions,
  assertPreparedRows,
  countPreparedRows,
};
