const { DateTime } = require("luxon");
const { shouldRunOnWeekday } = require("../scheduleWeekdays");

function getMonthlyDay(subscription, localDate) {
  return Math.min(Number(subscription.day_of_month) || 1, localDate.daysInMonth);
}

function getScheduledTime(subscription, localNow) {
  return localNow.set({
    hour: Number(subscription.local_delivery_time.split(":")[0]),
    millisecond: 0,
    minute: Number(subscription.local_delivery_time.split(":")[1]),
    second: 0,
  });
}

function getLastAttempt(subscription) {
  const value = subscription.last_attempted_at
    || subscription.last_delivered_at
    || subscription.last_noop_at;
  return value ? new Date(value) : null;
}

function isLateKpiDeliveryDue(subscription, now) {
  if (subscription.content_mode !== "kpi_review"
    || subscription.last_delivery_status !== "waiting_for_data") return false;
  const lastAttemptValue = getLastAttempt(subscription);
  if (!lastAttemptValue) return false;
  const lastAttempt = DateTime.fromJSDate(lastAttemptValue).setZone(subscription.timezone);
  const nextRegularIso = getNextDigestDelivery({
    ...subscription,
    enabled: true,
  }, lastAttempt.plus({ minutes: 1 }));
  if (!nextRegularIso) return false;
  return now.toUTC() < DateTime.fromISO(nextRegularIso, { zone: "utc" });
}

function isDigestDue(subscription, now = DateTime.utc()) {
  const localNow = now.setZone(subscription.timezone);
  if (!localNow.isValid) return false;
  if (isLateKpiDeliveryDue(subscription, localNow)) return true;
  const scheduled = getScheduledTime(subscription, localNow);
  const waitMinutes = subscription.content_mode === "kpi_review"
    ? Number(subscription.evaluation_wait_minutes) || 0
    : 0;
  const withinWindow = localNow >= scheduled
    && localNow < scheduled.plus({ minutes: Math.max(15, waitMinutes + 15) });
  if (!withinWindow) return false;
  const deliveryDay = Number(subscription.day_of_week) || 1;
  if (subscription.cadence === "weekly" && localNow.weekday !== deliveryDay) return false;
  if (subscription.cadence === "monthly"
    && localNow.day !== getMonthlyDay(subscription, localNow)) return false;
  if (subscription.cadence === "daily"
    && !shouldRunOnWeekday(subscription.delivery_days, localNow)) return false;
  const lastAttemptValue = getLastAttempt(subscription);
  if (!lastAttemptValue) return true;
  const lastAttempt = DateTime.fromJSDate(lastAttemptValue).setZone(subscription.timezone);
  return !lastAttempt.hasSame(localNow, "day");
}

function getNextDigestDelivery(subscription, now = DateTime.utc()) {
  if (!subscription.enabled) return null;
  const localNow = now.setZone(subscription.timezone);
  if (!localNow.isValid) return null;
  let next = getScheduledTime(subscription, localNow);
  if (subscription.cadence === "weekly") {
    const deliveryDay = Number(subscription.day_of_week) || 1;
    const daysAhead = (deliveryDay - localNow.weekday + 7) % 7;
    next = next.plus({ days: daysAhead });
    if (next <= localNow) next = next.plus({ weeks: 1 });
  } else if (subscription.cadence === "monthly") {
    next = next.set({ day: getMonthlyDay(subscription, next) });
    if (next <= localNow) {
      next = next.plus({ months: 1 }).set({ day: 1 });
      next = next.set({ day: getMonthlyDay(subscription, next) });
    }
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
  getScheduledTime,
  isDigestDue,
  isLateKpiDeliveryDue,
};
