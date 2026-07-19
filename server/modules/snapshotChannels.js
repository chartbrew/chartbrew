function getSnapshotEmailRecipients(snapshotSchedule = {}) {
  if (!snapshotSchedule?.mediums?.email?.enabled || !Array.isArray(snapshotSchedule?.customEmails)) {
    return [];
  }

  return snapshotSchedule.customEmails
    .map((email) => typeof email === "string" ? email.trim() : "")
    .filter(Boolean);
}

function getEnabledSnapshotIntegrations(snapshotSchedule = {}) {
  if (!Array.isArray(snapshotSchedule?.integrations)) {
    return [];
  }

  return snapshotSchedule.integrations.filter((integration) => integration?.enabled);
}

function hasSnapshotChannels(snapshotSchedule = {}) {
  return getSnapshotEmailRecipients(snapshotSchedule).length > 0
    || getEnabledSnapshotIntegrations(snapshotSchedule).length > 0;
}

module.exports = {
  getEnabledSnapshotIntegrations,
  getSnapshotEmailRecipients,
  hasSnapshotChannels,
};
