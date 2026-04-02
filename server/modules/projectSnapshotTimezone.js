function isBlank(value) {
  return value === null || value === undefined || value === "";
}

function normalizeProjectScheduleTimezones(data = {}) {
  const normalizedData = { ...data };
  const scheduleFields = ["updateSchedule", "snapshotSchedule"];

  scheduleFields.forEach((field) => {
    if (!normalizedData[field] || typeof normalizedData[field] !== "object" || Array.isArray(normalizedData[field])) {
      return;
    }

    const schedule = { ...normalizedData[field] };
    const scheduleTimezone = schedule.timezone;

    if (isBlank(normalizedData.timezone) && !isBlank(scheduleTimezone)) {
      normalizedData.timezone = scheduleTimezone;
    }

    if (Object.prototype.hasOwnProperty.call(schedule, "timezone")) {
      delete schedule.timezone;
    }

    normalizedData[field] = schedule;
  });

  return normalizedData;
}

function getProjectScheduleTimezone(project, scheduleField) {
  return project?.timezone || project?.[scheduleField]?.timezone || "UTC";
}

function getProjectSnapshotTimezone(project) {
  return getProjectScheduleTimezone(project, "snapshotSchedule");
}

function getProjectUpdateTimezone(project) {
  return getProjectScheduleTimezone(project, "updateSchedule");
}

module.exports = {
  getProjectScheduleTimezone,
  getProjectSnapshotTimezone,
  getProjectUpdateTimezone,
  normalizeProjectScheduleTimezones,
};
