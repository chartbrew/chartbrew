const { col, fn, Op } = require("sequelize");

const db = require("../models/models");
const { buildCalibrationReport } = require("../modules/observations/calibrationReport");

const REPORT_LIMIT = 5000;

async function run() {
  try {
    const [auditRows, feedbackRows, usage, read, saved, dismissed, snoozed, resolved] = await Promise.all([
      db.ObservationAudit.findAll({
        attributes: ["observation_id", "verdict"],
        limit: REPORT_LIMIT + 1,
        order: [["createdAt", "DESC"]],
      }),
      db.ObservationFeedback.findAll({
        attributes: ["reason_code", "verdict"],
        include: [{
          attributes: [
            "direction",
            "evidence",
            "id",
            "relative_delta",
            "score",
            "score_version",
            "severity",
          ],
          include: [{
            attributes: ["baseline_policy", "kind", "metric_spec"],
            model: db.MetricMonitor,
            required: false,
          }],
          model: db.Observation,
          required: true,
        }],
        limit: REPORT_LIMIT + 1,
        order: [["updatedAt", "DESC"]],
      }),
      db.AiUsage.findOne({
        attributes: [
          [fn("COUNT", col("id")), "calls"],
          [fn("SUM", col("cost_micros")), "costMicros"],
          [fn("SUM", col("total_tokens")), "tokens"],
        ],
        raw: true,
        where: { purpose: "observation_audit" },
      }),
      db.ObservationPreference.count({ where: { read_at: { [Op.ne]: null } } }),
      db.ObservationPreference.count({ where: { saved_at: { [Op.ne]: null } } }),
      db.ObservationPreference.count({ where: { dismissed_at: { [Op.ne]: null } } }),
      db.ObservationPreference.count({ where: { snoozed_until: { [Op.ne]: null } } }),
      db.Observation.count({ where: { status: "resolved" } }),
    ]);
    const audits = auditRows.slice(0, REPORT_LIMIT);
    const feedback = feedbackRows.slice(0, REPORT_LIMIT);
    process.stdout.write(`${JSON.stringify(buildCalibrationReport({
      audits,
      engagement: {
        dismissed,
        read,
        resolved,
        saved,
        snoozed,
      },
      feedback,
      limits: {
        audits: REPORT_LIMIT,
        auditsTruncated: auditRows.length > REPORT_LIMIT,
        feedback: REPORT_LIMIT,
        feedbackTruncated: feedbackRows.length > REPORT_LIMIT,
      },
      usage: {
        calls: Number(usage?.calls) || 0,
        costMicros: Number(usage?.costMicros) || 0,
        tokens: Number(usage?.tokens) || 0,
      },
    }), null, 2)}\n`);
  } finally {
    await db.sequelize.close();
  }
}

run().catch((error) => {
  process.stderr.write(`${error?.stack || error?.message || String(error)}\n`);
  process.exitCode = 1;
});
