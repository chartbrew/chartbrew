const db = require("../models/models");
const packageJson = require("../package.json");
const { getEnvIntelligencePolicy } = require("../modules/intelligence/envPolicyProvider");
const {
  PLATFORM_SETTING_DEFINITIONS,
  PLATFORM_SETTING_GROUPS,
  getPathValue,
  validateSettingValue,
} = require("../modules/platformSettings/configuration");
const {
  getPlatformIntelligencePolicy,
  getPlatformSettingOverrides,
  refreshPlatformSettings,
} = require("../modules/platformSettings/runtime");

const PLATFORM_LINKS = Object.freeze([
  { id: "website", label: "Website", url: "https://chartbrew.com" },
  { id: "github", label: "GitHub", url: "https://github.com/chartbrew/chartbrew" },
  { id: "blog", label: "Blog", url: "https://chartbrew.com/blog" },
  { id: "sponsors", label: "Support Chartbrew", url: "https://github.com/sponsors/chartbrew" },
]);

function isAiProviderConfigured(env = process.env) {
  const apiKey = env.NODE_ENV === "production"
    ? env.CB_OPENAI_API_KEY
    : env.CB_OPENAI_API_KEY_DEV;
  return Boolean(apiKey);
}

class PlatformSettingsController {
  async get() {
    await refreshPlatformSettings();
    const deploymentPolicy = getEnvIntelligencePolicy();
    const effectivePolicy = getPlatformIntelligencePolicy();
    const overrides = getPlatformSettingOverrides();
    const aiProviderConfigured = isAiProviderConfigured();

    const settingsByGroup = new Map(
      PLATFORM_SETTING_GROUPS.map((group) => [group.id, []])
    );
    PLATFORM_SETTING_DEFINITIONS.forEach((definition) => {
      if (definition.requiresProvider && !aiProviderConfigured) return;
      const publicDefinition = { ...definition };
      delete publicDefinition.requiresProvider;
      settingsByGroup.get(definition.group).push({
        ...publicDefinition,
        value: getPathValue(effectivePolicy, definition.key),
        defaultValue: getPathValue(deploymentPolicy, definition.key),
        overridden: Object.hasOwn(overrides, definition.key),
      });
    });

    return {
      version: packageJson.version,
      links: PLATFORM_LINKS,
      groups: PLATFORM_SETTING_GROUPS.map((group) => ({
        ...group,
        settings: settingsByGroup.get(group.id),
      })),
    };
  }

  async update(userId, input = {}) {
    if (!input.settings || typeof input.settings !== "object" || Array.isArray(input.settings)) {
      const error = new Error("Settings must be an object");
      error.statusCode = 400;
      throw error;
    }

    const entries = Object.entries(input.settings);
    if (entries.length < 1 || entries.length > PLATFORM_SETTING_DEFINITIONS.length) {
      const error = new Error("Select at least one valid setting");
      error.statusCode = 400;
      throw error;
    }
    const validated = entries.map(([key, value]) => [key, validateSettingValue(key, value)]);

    const transaction = await db.sequelize.transaction();
    try {
      await Promise.all(validated.map(([key, value]) => (
        db.PlatformSetting.upsert({
          key,
          value,
          updated_by: userId,
        }, { transaction })
      )));
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    return this.get();
  }

  async reset(input = {}) {
    if (!Array.isArray(input.keys) || input.keys.length < 1) {
      const error = new Error("Select at least one setting to restore");
      error.statusCode = 400;
      throw error;
    }
    const keys = [...new Set(input.keys)];
    keys.forEach((key) => validateSettingValue(
      key,
      getPathValue(getEnvIntelligencePolicy(), key)
    ));
    await db.PlatformSetting.destroy({ where: { key: keys } });
    return this.get();
  }
}

module.exports = PlatformSettingsController;
