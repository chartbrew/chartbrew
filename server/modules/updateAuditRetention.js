const cron = require("node-cron");

const { cleanupExpiredRuns } = require("./updateAudit");

module.exports = () => {
  const retentionDays = process.env.CB_UPDATE_AUDIT_RETENTION_DAYS || 30;

  cleanupExpiredRuns(retentionDays);

  cron.schedule("15 2 * * *", () => {
    cleanupExpiredRuns(retentionDays);
  });

  return true;
};
