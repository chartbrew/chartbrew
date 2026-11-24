const { Op } = require("sequelize");
const db = require("../../models/models");

async function cleanupSlackData({ dryRun = false, now = new Date() } = {}) {
  const tokens = { expires_at: { [Op.lt]: now } };
  const count = await db.SlackLinkToken.count({ where: tokens });
  if (!dryRun) {
    await db.SlackLinkToken.destroy({ where: tokens });
  }
  return { dryRun, requests: 0, linkTokens: count };
}

module.exports = { cleanupSlackData };
