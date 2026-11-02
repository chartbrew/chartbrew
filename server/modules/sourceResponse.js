const { sanitizeSnippet } = require("./updateAudit");

function parseSourceResponse(response) {
  const status = Number(response.statusCode);
  if (status < 200 || status >= 300 || !Number.isFinite(status)) {
    let body = response.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        // The source may return a plain-text error.
      }
    }
    const detail = sanitizeSnippet(body?.error?.message || body?.message || body?.error || body);
    const error = new Error(`The data source returned HTTP ${status}.${detail ? ` ${detail}` : ""}`);
    error.code = "SOURCE_REQUEST_FAILED";
    error.statusCode = Number.isInteger(status) ? status : 502;
    throw error;
  }
  if ([204, 205].includes(status) && !response.body) return [];
  if (response.body !== null && typeof response.body === "object") return response.body;
  return JSON.parse(response.body);
}

module.exports = { parseSourceResponse };
