const {
  DEFAULT_SCORING_VERSION,
  SCORING_POLICIES,
} = require("../observations/scoringPolicies");

const DEFAULT_DATASET_INTELLIGENCE_POLICY = Object.freeze({
  enabled: true,
  autoProfile: true,
  profileTtlHours: 168,
  maxSampleRows: 200,
  maxFields: 200,
  llmEnrichment: false,
  backfillBatchSize: 25,
});

const DEFAULT_OBSERVATION_POLICY = Object.freeze({
  enabled: true,
  autoMonitorCharts: false,
  minimumSamples: 7,
  maximumMonitors: 100,
  maximumSnapshotsPerRefresh: 1200,
  deduplicationCooldownDays: 7,
  publishScore: 0.75,
  minimumRelativeChange: 0.1,
  minimumPercentagePointChange: 1,
  scoringVersion: DEFAULT_SCORING_VERSION,
  llmAuditMode: "off",
  llmAuditSampleRate: 0.05,
  llmAuditDailyLimit: 20,
  llmAuditDailyTokenLimit: 20000,
});

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (/^(1|true|yes|on)$/i.test(`${value}`)) return true;
  if (/^(0|false|no|off)$/i.test(`${value}`)) return false;
  return fallback;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNumber(value, fallback, minimum = 0, maximum = Number.POSITIVE_INFINITY) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function getEnvIntelligencePolicy(env = process.env) {
  return {
    datasetIntelligence: {
      enabled: parseBoolean(
        env.CB_DATASET_INTELLIGENCE_ENABLED,
        DEFAULT_DATASET_INTELLIGENCE_POLICY.enabled
      ),
      autoProfile: parseBoolean(
        env.CB_DATASET_INTELLIGENCE_AUTO_PROFILE,
        DEFAULT_DATASET_INTELLIGENCE_POLICY.autoProfile
      ),
      profileTtlHours: parsePositiveInteger(
        env.CB_DATASET_INTELLIGENCE_PROFILE_TTL_HOURS,
        DEFAULT_DATASET_INTELLIGENCE_POLICY.profileTtlHours
      ),
      maxSampleRows: parsePositiveInteger(
        env.CB_DATASET_INTELLIGENCE_MAX_SAMPLE_ROWS,
        DEFAULT_DATASET_INTELLIGENCE_POLICY.maxSampleRows
      ),
      maxFields: parsePositiveInteger(
        env.CB_DATASET_INTELLIGENCE_MAX_FIELDS,
        DEFAULT_DATASET_INTELLIGENCE_POLICY.maxFields
      ),
      llmEnrichment: parseBoolean(
        env.CB_DATASET_INTELLIGENCE_LLM_ENRICHMENT,
        DEFAULT_DATASET_INTELLIGENCE_POLICY.llmEnrichment
      ),
      backfillBatchSize: parsePositiveInteger(
        env.CB_DATASET_INTELLIGENCE_BACKFILL_BATCH_SIZE,
        DEFAULT_DATASET_INTELLIGENCE_POLICY.backfillBatchSize
      ),
    },
    observations: {
      enabled: parseBoolean(
        env.CB_OBSERVATIONS_ENABLED,
        DEFAULT_OBSERVATION_POLICY.enabled
      ),
      autoMonitorCharts: parseBoolean(
        env.CB_OBSERVATIONS_AUTO_MONITOR_CHARTS,
        DEFAULT_OBSERVATION_POLICY.autoMonitorCharts
      ),
      minimumSamples: parsePositiveInteger(
        env.CB_OBSERVATIONS_MINIMUM_SAMPLES,
        DEFAULT_OBSERVATION_POLICY.minimumSamples
      ),
      maximumMonitors: parsePositiveInteger(
        env.CB_OBSERVATIONS_MAXIMUM_MONITORS,
        DEFAULT_OBSERVATION_POLICY.maximumMonitors
      ),
      maximumSnapshotsPerRefresh: parsePositiveInteger(
        env.CB_OBSERVATIONS_MAX_SNAPSHOTS_PER_REFRESH,
        DEFAULT_OBSERVATION_POLICY.maximumSnapshotsPerRefresh
      ),
      deduplicationCooldownDays: parsePositiveInteger(
        env.CB_OBSERVATIONS_DEDUPLICATION_COOLDOWN_DAYS,
        DEFAULT_OBSERVATION_POLICY.deduplicationCooldownDays
      ),
      publishScore: parseNumber(
        env.CB_OBSERVATIONS_PUBLISH_SCORE,
        DEFAULT_OBSERVATION_POLICY.publishScore,
        0,
        1
      ),
      minimumRelativeChange: parseNumber(
        env.CB_OBSERVATIONS_MINIMUM_RELATIVE_CHANGE,
        DEFAULT_OBSERVATION_POLICY.minimumRelativeChange,
        0,
        10
      ),
      minimumPercentagePointChange: parseNumber(
        env.CB_OBSERVATIONS_MINIMUM_PERCENTAGE_POINT_CHANGE,
        DEFAULT_OBSERVATION_POLICY.minimumPercentagePointChange,
        0,
        100
      ),
      scoringVersion: SCORING_POLICIES[env.CB_OBSERVATIONS_SCORING_VERSION]
        ? env.CB_OBSERVATIONS_SCORING_VERSION
        : DEFAULT_OBSERVATION_POLICY.scoringVersion,
      llmAuditMode: ["off", "shadow_sample", "shadow_published", "manual"].includes(
        env.CB_OBSERVATIONS_LLM_AUDIT_MODE
      )
        ? env.CB_OBSERVATIONS_LLM_AUDIT_MODE
        : DEFAULT_OBSERVATION_POLICY.llmAuditMode,
      llmAuditSampleRate: parseNumber(
        env.CB_OBSERVATIONS_LLM_AUDIT_SAMPLE_RATE,
        DEFAULT_OBSERVATION_POLICY.llmAuditSampleRate,
        0,
        1
      ),
      llmAuditDailyLimit: parsePositiveInteger(
        env.CB_OBSERVATIONS_LLM_AUDIT_DAILY_LIMIT,
        DEFAULT_OBSERVATION_POLICY.llmAuditDailyLimit
      ),
      llmAuditDailyTokenLimit: parsePositiveInteger(
        env.CB_OBSERVATIONS_LLM_AUDIT_DAILY_TOKEN_LIMIT,
        DEFAULT_OBSERVATION_POLICY.llmAuditDailyTokenLimit
      ),
    },
  };
}

module.exports = {
  DEFAULT_DATASET_INTELLIGENCE_POLICY,
  DEFAULT_OBSERVATION_POLICY,
  getEnvIntelligencePolicy,
  parseBoolean,
  parseNumber,
  parsePositiveInteger,
};
