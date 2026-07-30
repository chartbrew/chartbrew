const { col, fn, Op } = require("sequelize");

const db = require("../models/models");

async function run() {
  try {
    const [audits, feedback, usage, read, saved, dismissed, snoozed, resolved] = await Promise.all([
      db.ObservationAudit.findAll({
        attributes: ["verdict"],
        limit: 5000,
        order: [["createdAt", "DESC"]],
      }),
      db.ObservationFeedback.findAll({
        attributes: ["verdict", [fn("COUNT", col("id")), "count"]],
        group: ["verdict"],
        raw: true,
      }),
      db.AiUsage.findOne({
        attributes: [
          [fn("COUNT", col("id")), "calls"],
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
    const auditSummary = audits.reduce((summary, audit) => {
      const key = audit.verdict?.relevant ? "relevant" : "notRelevant";
      summary[key] += 1;
      if (!audit.verdict?.evidenceSupported) summary.unsupported += 1;
      (audit.verdict?.suggestedWeightChanges || []).forEach((suggestion) => {
        const suggestionKey = `${suggestion.feature}:${suggestion.direction}`;
        summary.suggestions[suggestionKey] = (summary.suggestions[suggestionKey] || 0) + 1;
      });
      return summary;
    }, {
      notRelevant: 0,
      relevant: 0,
      suggestions: {},
      unsupported: 0,
    });
    process.stdout.write(`${JSON.stringify({
      audits: auditSummary,
      engagement: {
        dismissed,
        read,
        resolved,
        saved,
        snoozed,
      },
      feedback,
      usage: {
        calls: Number(usage?.calls) || 0,
        tokens: Number(usage?.tokens) || 0,
      },
    }, null, 2)}\n`);
  } finally {
    await db.sequelize.close();
  }
}

run().catch((error) => {
  process.stderr.write(`${error?.stack || error?.message || String(error)}\n`);
  process.exitCode = 1;
});
