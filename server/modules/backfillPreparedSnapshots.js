const { Op } = require("sequelize");

const ChartController = require("../controllers/ChartController");
const db = require("../models/models");
const { withExecutionDeadline } = require("./dataApiLimits");
const { getPreparedSnapshotMaxBytes } = require("./preparedSnapshot");
const { serializePreparedDataSnapshot } = require("../visualization/preparedData");

function parsePositiveInt(value, fallback) {
  const parsedValue = parseInt(value, 10);
  if (Number.isNaN(parsedValue) || parsedValue <= 0) return fallback;
  return parsedValue;
}

async function backfillPreparedSnapshots(options = {}) {
  const batchSize = parsePositiveInt(options.batchSize, 25);
  const limit = options.limit ? parsePositiveInt(options.limit, null) : null;
  const timeoutMs = parsePositiveInt(options.timeoutMs, 120000);
  const controller = options.controller || new ChartController();
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => {};
  const report = {
    dryRun: Boolean(options.dryRun),
    failed: 0,
    failures: [],
    inferred: 0,
    issues: [],
    lastChartId: Number(options.afterId) || 0,
    processed: 0,
    refreshUnresolved: Boolean(options.refreshUnresolved),
    refreshed: 0,
    saved: 0,
    skipped: 0,
    timeoutMs,
    unresolved: 0,
    wouldInfer: 0,
    wouldSave: 0,
  };

  while (!limit || report.processed < limit) {
    const remaining = limit ? limit - report.processed : batchSize;
    const charts = await db.Chart.unscoped().findAll({ // oxlint-disable-line no-await-in-loop
      attributes: ["id", "preparedData"],
      limit: Math.min(batchSize, remaining),
      order: [["id", "ASC"]],
      where: {
        ...(options.refreshUnresolved ? { chartData: { [Op.is]: null } } : {}),
        id: { [Op.gt]: report.lastChartId },
        ...(options.force ? {} : { preparedData: { [Op.is]: null } }),
      },
    });
    if (charts.length === 0) break;

    for (const chart of charts) {
      report.lastChartId = Number(chart.id);
      report.processed += 1;
      onProgress({
        chartId: chart.id,
        processed: report.processed,
        type: "chart_started",
      });
      const finish = (status, message) => onProgress({
        chartId: chart.id,
        ...(message ? { message } : {}),
        processed: report.processed,
        status,
        type: "chart_finished",
      });

      if (options.refreshUnresolved) {
        try {
          const result = await withExecutionDeadline(({ signal, deadlineAt }) => { // oxlint-disable-line no-await-in-loop
            return controller.updateChartData(chart.id, null, {
              deadlineAt,
              finalizeRun: false,
              getCache: false,
              maintainDatasetMetadata: false,
              noSource: false,
              returnPreparedData: true,
              runtimeOnly: Boolean(options.dryRun),
              signal,
              skipSave: Boolean(options.dryRun),
              traceContext: null,
            });
          }, timeoutMs);
          if (options.dryRun) {
            const serialized = serializePreparedDataSnapshot(result.preparedData);
            const sizeBytes = Buffer.byteLength(serialized, "utf8");
            const maxBytes = getPreparedSnapshotMaxBytes();
            if (sizeBytes > maxBytes) throw new Error("Prepared snapshot exceeds the size limit");
            report.wouldSave += 1;
            finish("would_refresh");
          } else if (result.snapshot?.saved) {
            report.refreshed += 1;
            report.saved += 1;
            finish("refreshed");
          } else {
            throw new Error(result.snapshot?.reason || "Snapshot was not saved");
          }
        } catch (error) {
          report.failed += 1;
          report.failures.push({
            chartId: chart.id,
            message: error.message || `${error}`,
          });
          finish("failed", error.message || `${error}`);
        }
        continue; // oxlint-disable-line no-continue
      }

      try {
        const result = await controller.prepareLegacyChartData(chart.id, { // oxlint-disable-line no-await-in-loop
          skipSave: Boolean(options.dryRun),
        });
        if (options.dryRun) {
          const serialized = serializePreparedDataSnapshot(result.preparedData);
          const sizeBytes = Buffer.byteLength(serialized, "utf8");
          const maxBytes = getPreparedSnapshotMaxBytes();
          if (sizeBytes <= maxBytes) {
            report.wouldInfer += 1;
            report.wouldSave += 1;
            finish("would_infer");
          } else {
            report.skipped += 1;
            report.issues.push({
              chartId: chart.id,
              maxBytes,
              reason: "size_limit_exceeded",
              sizeBytes,
            });
            finish("size_limit_exceeded");
          }
        } else if (result.snapshot?.saved) {
          report.inferred += 1;
          report.saved += 1;
          finish("inferred");
        } else {
          report.skipped += 1;
          report.issues.push({
            chartId: chart.id,
            reason: result.snapshot?.reason || "snapshot_not_saved",
            sizeBytes: result.snapshot?.sizeBytes || null,
          });
          finish(result.snapshot?.reason || "snapshot_not_saved");
        }
      } catch (inferenceError) {
        report.unresolved += 1;
        report.issues.push({
          chartId: chart.id,
          message: inferenceError.message || `${inferenceError}`,
          reason: "legacy_inference_failed",
        });
        finish("unresolved", inferenceError.message || `${inferenceError}`);
      }
    }
  }

  return report;
}

module.exports = {
  backfillPreparedSnapshots,
};
