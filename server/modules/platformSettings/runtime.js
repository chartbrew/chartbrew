const db = require("../../models/models");
const { getEnvIntelligencePolicy } = require("../intelligence/envPolicyProvider");
const {
  applyPlatformSettingOverrides,
  validateSettingValue,
} = require("./configuration");

const REFRESH_INTERVAL_MS = 30000;

let settingOverrides = Object.freeze({});
let refreshTimer = null;

function setPlatformSettingOverrides(overrides = {}) {
  const validated = {};
  Object.entries(overrides).forEach(([key, value]) => {
    validated[key] = validateSettingValue(key, value);
  });
  settingOverrides = Object.freeze(validated);
  return settingOverrides;
}

async function refreshPlatformSettings() {
  const rows = await db.PlatformSetting.findAll({
    attributes: ["key", "value"],
  });
  const overrides = {};
  rows.forEach((row) => {
    try {
      overrides[row.key] = validateSettingValue(row.key, row.value);
    } catch (error) {
      // Ignore invalid or retired values and keep the safe deployment value.
    }
  });
  return setPlatformSettingOverrides(overrides);
}

function getPlatformSettingOverrides() {
  return settingOverrides;
}

function getPlatformIntelligencePolicy(env = process.env) {
  return applyPlatformSettingOverrides(
    getEnvIntelligencePolicy(env),
    settingOverrides
  );
}

function startPlatformSettingsRefresh() {
  if (refreshTimer) return refreshTimer;
  refreshTimer = setInterval(() => {
    refreshPlatformSettings().catch(() => {});
  }, REFRESH_INTERVAL_MS);
  refreshTimer.unref?.();
  return refreshTimer;
}

function stopPlatformSettingsRefresh() {
  if (!refreshTimer) return;
  clearInterval(refreshTimer);
  refreshTimer = null;
}

module.exports = {
  getPlatformIntelligencePolicy,
  getPlatformSettingOverrides,
  refreshPlatformSettings,
  setPlatformSettingOverrides,
  startPlatformSettingsRefresh,
  stopPlatformSettingsRefresh,
};
