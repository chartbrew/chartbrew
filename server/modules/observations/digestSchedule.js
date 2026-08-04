const { DateTime } = require("luxon");
const { shouldRunOnWeekday } = require("../scheduleWeekdays");

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
  const deliveryDay = Number(subscription.day_of_week) || 1;
  if (subscription.cadence === "weekly" && localNow.weekday !== deliveryDay) return false;
  if (subscription.cadence === "daily"
    && !shouldRunOnWeekday(subscription.delivery_days, localNow)) return false;
  if (!subscription.last_attempted_at
    && !subscription.last_delivered_at
    && !subscription.last_noop_at) return true;
  const lastAttempt = DateTime.fromJSDate(
    new Date(
      subscription.last_attempted_at
      || subscription.last_delivered_at
      || subscription.last_noop_at
    ),
  ).setZone(subscription.timezone);
  return !lastAttempt.hasSame(localNow, "day");
}

function getNextDigestDelivery(subscription, now = DateTime.utc()) {
  if (!subscription.enabled) return null;
  const localNow = now.setZone(subscription.timezone);
  if (!localNow.isValid) return null;
  const [hour, minute] = subscription.local_delivery_time.split(":").map(Number);
  let next = localNow.set({ hour, millisecond: 0, minute, second: 0 });
  if (subscription.cadence === "weekly") {
    const deliveryDay = Number(subscription.day_of_week) || 1;
    const daysAhead = (deliveryDay - localNow.weekday + 7) % 7;
    next = next.plus({ days: daysAhead });
    if (next <= localNow) next = next.plus({ weeks: 1 });
  } else {
    if (next <= localNow) next = next.plus({ days: 1 });
    let daysChecked = 0;
    while (!shouldRunOnWeekday(subscription.delivery_days, next) && daysChecked < 7) {
      next = next.plus({ days: 1 });
      daysChecked += 1;
    }
    if (!shouldRunOnWeekday(subscription.delivery_days, next)) return null;
  }
  return next.toUTC().toISO();
}

module.exports = {
  getNextDigestDelivery,
  isDigestDue,
};
