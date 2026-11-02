const { Op } = require("sequelize");

const db = require("../../models/models");
const { getWorkspaceOrchestratorPolicy } = require("./policy");

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeWorkspaceRetentionOptions(options = {}) {
  const policy = getWorkspaceOrchestratorPolicy();
  const daysValue = options.actionAuditDays ?? policy.actionAuditRetentionDays;
  const days = Number.parseInt(daysValue, 10);
  const batchValue = Number.parseInt(options.batchSize, 10);
  return {
    actionAuditDays: Number.isInteger(days) && days >= 0 ? Math.min(days, 3650) : 365,
    batchSize: Number.isInteger(batchValue) && batchValue > 0 ? Math.min(batchValue, 5000) : 1000,
    dryRun: Boolean(options.dryRun),
    now: options.now || new Date(),
  };
}

async function getAuditRetentionReport(options, auditModel = db.OrchestratorActionAudit) {
  if (options.actionAuditDays === 0) {
    return {
      disabled: true,
      warning: "Action audit cleanup is disabled",
    };
  }
  const cutoff = new Date(options.now.getTime() - (options.actionAuditDays * DAY_MS));
  const where = { createdAt: { [Op.lt]: cutoff } };
  const [matched, oldest] = await Promise.all([
    auditModel.count({ where }),
    auditModel.findOne({
      attributes: ["createdAt"],
      order: [["createdAt", "ASC"], ["id", "ASC"]],
      where,
    }),
  ]);
  return {
    cutoff,
    matched,
    oldest: oldest?.createdAt || null,
  };
}

async function cleanupWorkspaceLearning(rawOptions = {}, dependencies = {}) {
  const options = normalizeWorkspaceRetentionOptions(rawOptions);
  const auditModel = dependencies.auditModel || db.OrchestratorActionAudit;
  const report = await getAuditRetentionReport(options, auditModel);
  if (options.dryRun || report.disabled || report.matched === 0) {
    return {
      actionAudits: report,
      dryRun: options.dryRun,
    };
  }
  let deleted = 0;
  while (deleted < report.matched) {
    // oxlint-disable-next-line no-await-in-loop
    const rows = await auditModel.findAll({
      attributes: ["id"],
      limit: options.batchSize,
      order: [["id", "ASC"]],
      where: { createdAt: { [Op.lt]: report.cutoff } },
    });
    if (rows.length === 0) break;
    // oxlint-disable-next-line no-await-in-loop
    const count = await auditModel.destroy({
      where: { id: { [Op.in]: rows.map((row) => row.id) } },
    });
    deleted += count;
    if (count === 0 || rows.length < options.batchSize) break;
  }
  return {
    actionAudits: {
      ...report,
      deleted,
    },
    dryRun: false,
  };
}

module.exports = {
  cleanupWorkspaceLearning,
  getAuditRetentionReport,
  normalizeWorkspaceRetentionOptions,
};
