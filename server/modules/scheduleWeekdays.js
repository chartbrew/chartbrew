const WEEKDAYS = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

function getWeekdayNumber(dayOfWeek) {
  if (typeof dayOfWeek === "number") {
    return dayOfWeek;
  }

  if (typeof dayOfWeek === "string") {
    return WEEKDAYS[dayOfWeek.toLowerCase()];
  }

  return null;
}

function shouldRunOnWeekday(daysOfWeek, now) {
  let normalizedDays = daysOfWeek;
  if (typeof daysOfWeek === "string") {
    try {
      normalizedDays = JSON.parse(daysOfWeek);
    } catch (error) {
      return true;
    }
  }

  if (!Array.isArray(normalizedDays)) {
    return true;
  }

  if (normalizedDays.length === 0) {
    return false;
  }

  return normalizedDays.some((dayOfWeek) => getWeekdayNumber(dayOfWeek) === now.weekday);
}

module.exports = {
  getWeekdayNumber,
  shouldRunOnWeekday,
};
