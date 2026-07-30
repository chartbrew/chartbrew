const cron = require("node-cron");
const { DateTime } = require("luxon");

const db = require("../../models/models");
const DigestController = require("../../controllers/DigestController");
const { getObservationAccess } = require("./access");
const { isDigestDue } = require("./digestSchedule");

async function deliverDueDigests(now = DateTime.utc()) {
  const subscriptions = await db.ObservationDigestSubscription.findAll({
    limit: 500,
    order: [["id", "ASC"]],
    where: { enabled: true, channel: "email" },
  });
  const controller = new DigestController();
  const report = { delivered: 0, failed: 0, noops: 0 };
  for (const subscription of subscriptions) {
    if (isDigestDue(subscription, now)) {
      try {
        // Access is recalculated at the moment of delivery.
        // oxlint-disable-next-line no-await-in-loop
        const access = await getObservationAccess(subscription.team_id, subscription.user_id);
        // oxlint-disable-next-line no-await-in-loop
        const result = await controller.deliver(access, subscription);
        if (result.delivered) report.delivered += 1;
        else report.noops += 1;
      } catch (error) {
        report.failed += 1;
        console.error("[observation-digest] Delivery failed", error.message); // oxlint-disable-line no-console
      }
    }
  }
  return report;
}

module.exports = () => {
  cron.schedule("*/15 * * * *", () => {
    deliverDueDigests().catch((error) => {
      console.error("[observation-digest] Scheduler failed", error.message); // oxlint-disable-line no-console
    });
  });
  return true;
};

module.exports.deliverDueDigests = deliverDueDigests;
module.exports.isDigestDue = isDigestDue;
