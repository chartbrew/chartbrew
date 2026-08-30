const { authorizeChartImage } = require("../modules/chartImage/imageAccess");
const { loadChartImageDocument } = require("../modules/chartImage/imageMetadata");
const { recordChartImageEvent } = require("../modules/chartImage/imageObservability");
const { normalizeImageRequest } = require("../modules/chartImage/imageRequest");
const { publicImageError } = require("../modules/chartImage/imageResponse");
const { RenderWorkerQueue } = require("../modules/chartImage/renderWorkerQueue");

class ChartImageController {
  constructor(options = {}) {
    this.authorize = options.authorize || authorizeChartImage;
    this.loadDocument = options.loadDocument || loadChartImageDocument;
    this.queue = options.queue || new RenderWorkerQueue();
    this.recordEvent = options.recordEvent || recordChartImageEvent;
  }

  _recordEvent(fields) {
    try {
      this.recordEvent(fields);
    } catch (_error) {
      // Image rendering must not depend on operational logging.
    }
  }

  async render(req, options = {}) {
    const startedAt = Date.now();
    let access = null;
    let normalized = null;
    let resolved = null;
    try {
      normalized = normalizeImageRequest(req.body);
      access = await this.authorize({
        chartId: req.params.chart_id,
        projectId: req.params.project_id,
        userId: req.user.id,
      });
      resolved = await this.loadDocument(access, normalized);
      const png = await this.queue.render(resolved.document, { signal: options.signal });
      this._recordEvent({
        ...access,
        durationMs: Date.now() - startedAt,
        height: normalized.height,
        layout: normalized.layout,
        operationalCodes: resolved.operationalCodes,
        outputBytes: png.length,
        preset: resolved.preset,
        requestId: req.id,
        success: true,
        width: normalized.width,
      });
      return png;
    } catch (error) {
      const safeError = publicImageError(error);
      this._recordEvent({
        ...access,
        chartId: access?.chartId || null,
        durationMs: Date.now() - startedAt,
        errorCode: safeError.code,
        height: normalized?.height,
        layout: normalized?.layout,
        operationalCodes: resolved?.operationalCodes,
        preset: resolved?.preset,
        projectId: access?.projectId || null,
        requestId: req.id,
        success: false,
        teamId: access?.teamId || null,
        userId: req.user?.id || null,
        width: normalized?.width,
      });
      throw safeError;
    }
  }
}

module.exports = ChartImageController;
