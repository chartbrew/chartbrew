const cron = require("node-cron");
const { Op } = require("sequelize");

const db = require("../../models/models");
const { evaluateMonitorPeriod } = require("./periodEvaluationService");

async function evaluateDuePeriods(now = new Date()) {
  const monitors = await db.MetricMonitor.findAll({
    limit: 500,
    order: [["next_evaluation_at", "ASC"], ["id", "ASC"]],
    where: {
      is_active: true,
      next_evaluation_at: { [Op.lte]: now },
    },
  });
  const report = { evaluated: 0, failed: 0, published: 0, waiting: 0 };
  for (const monitor of monitors) {
    try {
      // Evaluation uses stored snapshots and never requests source data.
      // oxlint-disable-next-line no-await-in-loop
      const result = await evaluateMonitorPeriod(monitor, { asOf: now });
      if (["final", "revised", "settling"].includes(result.status)) report.evaluated += 1;
      else report.waiting += 1;
      if (["corrected", "published", "updated"].includes(result.publication?.status)) {
        report.published += 1;
      }
    } catch (error) {
      report.failed += 1;
      console.error("[period-evaluation] Evaluation failed", error.message); // oxlint-disable-line no-console
    }
  }
  return report;
}

module.exports = () => {
  evaluateDuePeriods().catch((error) => {
    console.error("[period-evaluation] Scheduler failed", error.message); // oxlint-disable-line no-console
  });
  cron.schedule("*/15 * * * *", () => {
    evaluateDuePeriods().catch((error) => {
      console.error("[period-evaluation] Scheduler failed", error.message); // oxlint-disable-line no-console
    });
  });
  return true;
};

module.exports.evaluateDuePeriods = evaluateDuePeriods;
