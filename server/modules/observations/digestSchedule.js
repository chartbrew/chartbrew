const { DateTime } = require("luxon");

function isDigestDue(subscription, now = DateTime.utc()) {
  const localNow = now.setZone(subscription.timezone);
  if (!localNow.isValid) return false;
  const [hour, minute] = subscription.local_delivery_time.split(":").map(Number);
  const scheduled = localNow.set({
    hour,
    millisecond: 0,
    minute,
    second: 0,
  });
  const withinWindow = localNow >= scheduled && localNow < scheduled.plus({ minutes: 15 });
  if (!withinWindow) return false;
  if (subscription.cadence === "weekly" && localNow.weekday !== 1) return false;
  if (!subscription.last_delivered_at && !subscription.last_noop_at) return true;
  const lastAttempt = DateTime.fromJSDate(
    new Date(subscription.last_delivered_at || subscription.last_noop_at),
  ).setZone(subscription.timezone);
  return !lastAttempt.hasSame(localNow, "day");
}

module.exports = {
  isDigestDue,
};
