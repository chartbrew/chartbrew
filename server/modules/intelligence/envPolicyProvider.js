const {
  DEFAULT_SCORING_VERSION,
  SCORING_POLICIES,
} = require("../observations/scoringPolicies");
const {
  DEFAULT_ANALYSIS_DEPTH,
  getAnalysisDepth,
  getAnalysisDepthPreset,
} = require("./orchestratorPresets");

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

const DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY = Object.freeze({
  actionAuditRetentionDays: 365,
  analysisDepth: DEFAULT_ANALYSIS_DEPTH,
  enabled: true,
  externalLearningContextEnabled: false,
  externalWorkspaceContextEnabled: false,
  kpiReviewWritesEnabled: true,
  learningRetrievalEnabled: true,
  maximumContextCharacters: 240000,
  maximumLearningCharacters: 24000,
  maximumLearningItems: 50,
  maximumModelTokensPerRequest: 80000,
  maximumParallelWorkers: 2,
  maximumPlannerCalls: 1,
  maximumPlannerOutputTokens: 4000,
  maximumRequestTimeMs: 90000,
  maximumRequestTimeSeconds: 90,
  maximumSynthesisOutputTokens: 5000,
  maximumSummaryLookbackDays: 365,
  maximumSynthesisCalls: 1,
  maximumToolCallsPerWorker: 6,
  maximumTotalToolCalls: 12,
  maximumWorkersPerRequest: 3,
  maximumWorkerOutputTokens: 4000,
  metricMonitorWritesEnabled: true,
  metricRecommendationsEnabled: true,
  plannerModel: "gpt-5.4-mini",
  plannerReasoningEffort: "high",
  plannerWorkerFallbackEnabled: false,
  previewTtlSeconds: 600,
  synthesisModel: "gpt-5.4-mini",
  synthesisReasoningEffort: "high",
  weakAttentionSignalsEnabled: true,
  workerModel: "gpt-5.6-luna",
  workerReasoningEffort: "low",
  workspaceSummariesEnabled: true,
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

function parseInteger(value, fallback, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function parseNumber(value, fallback, minimum = 0, maximum = Number.POSITIVE_INFINITY) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function parseReasoningEffort(value, fallback) {
  return ["low", "medium", "high"].includes(value) ? value : fallback;
}

function getEnvIntelligencePolicy(env = process.env) {
  const compatibilityModel = env.NODE_ENV === "production"
    ? env.CB_OPENAI_MODEL
    : env.CB_OPENAI_MODEL_DEV || env.CB_OPENAI_MODEL;
  const analysisDepth = getAnalysisDepth(env.CB_WORKSPACE_ANALYSIS_DEPTH);
  const analysisDepthPreset = getAnalysisDepthPreset(analysisDepth);
  const maximumRequestTimeMs = parseInteger(
    env.CB_WORKSPACE_MAXIMUM_REQUEST_TIME_MS,
    DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.maximumRequestTimeMs,
    15000,
    300000
  );
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
    workspaceOrchestrator: {
      actionAuditRetentionDays: parseInteger(
        env.CB_ORCHESTRATOR_ACTION_AUDIT_RETENTION_DAYS,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.actionAuditRetentionDays,
        0,
        3650
      ),
      analysisDepth,
      enabled: parseBoolean(
        env.CB_WORKSPACE_ORCHESTRATOR_ENABLED,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.enabled
      ),
      externalLearningContextEnabled: parseBoolean(
        env.CB_WORKSPACE_EXTERNAL_LEARNING_CONTEXT_ENABLED,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.externalLearningContextEnabled
      ),
      externalWorkspaceContextEnabled: parseBoolean(
        env.CB_WORKSPACE_EXTERNAL_CONTEXT_ENABLED,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.externalWorkspaceContextEnabled
      ),
      kpiReviewWritesEnabled: parseBoolean(
        env.CB_WORKSPACE_KPI_REVIEW_WRITES_ENABLED,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.kpiReviewWritesEnabled
      ),
      learningRetrievalEnabled: parseBoolean(
        env.CB_WORKSPACE_LEARNING_RETRIEVAL_ENABLED,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.learningRetrievalEnabled
      ),
      maximumContextCharacters: parseInteger(
        env.CB_WORKSPACE_CONTEXT_MAX_CHARACTERS,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.maximumContextCharacters,
        1000,
        240000
      ),
      maximumLearningCharacters: parseInteger(
        env.CB_WORKSPACE_LEARNING_MAX_CHARACTERS,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.maximumLearningCharacters,
        1000,
        24000
      ),
      maximumLearningItems: parseInteger(
        env.CB_WORKSPACE_LEARNING_MAX_ITEMS,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.maximumLearningItems,
        1,
        50
      ),
      maximumModelTokensPerRequest: parseInteger(
        env.CB_WORKSPACE_MAXIMUM_MODEL_TOKENS,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.maximumModelTokensPerRequest,
        10000,
        250000
      ),
      maximumParallelWorkers: parseInteger(
        env.CB_WORKSPACE_MAXIMUM_PARALLEL_WORKERS,
        analysisDepthPreset.maximumParallelWorkers,
        1,
        2
      ),
      maximumPlannerCalls: 1,
      maximumPlannerOutputTokens: parseInteger(
        env.CB_WORKSPACE_MAXIMUM_PLANNER_OUTPUT_TOKENS,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.maximumPlannerOutputTokens,
        256,
        8000
      ),
      maximumRequestTimeMs,
      maximumRequestTimeSeconds: Math.ceil(maximumRequestTimeMs / 1000),
      maximumSummaryLookbackDays: parseInteger(
        env.CB_WORKSPACE_SUMMARY_MAX_LOOKBACK_DAYS,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.maximumSummaryLookbackDays,
        30,
        3650
      ),
      maximumSynthesisCalls: 1,
      maximumSynthesisOutputTokens: parseInteger(
        env.CB_WORKSPACE_MAXIMUM_SYNTHESIS_OUTPUT_TOKENS,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.maximumSynthesisOutputTokens,
        256,
        8000
      ),
      maximumToolCallsPerWorker: parseInteger(
        env.CB_WORKSPACE_MAXIMUM_TOOL_CALLS_PER_WORKER,
        analysisDepthPreset.maximumToolCallsPerWorker,
        1,
        6
      ),
      maximumTotalToolCalls: parseInteger(
        env.CB_WORKSPACE_MAXIMUM_TOTAL_TOOL_CALLS,
        analysisDepthPreset.maximumTotalToolCalls,
        1,
        18
      ),
      maximumWorkersPerRequest: parseInteger(
        env.CB_WORKSPACE_MAXIMUM_WORKERS_PER_REQUEST,
        analysisDepthPreset.maximumWorkersPerRequest,
        1,
        4
      ),
      maximumWorkerOutputTokens: parseInteger(
        env.CB_WORKSPACE_MAXIMUM_WORKER_OUTPUT_TOKENS,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.maximumWorkerOutputTokens,
        256,
        8000
      ),
      metricMonitorWritesEnabled: parseBoolean(
        env.CB_WORKSPACE_METRIC_MONITOR_WRITES_ENABLED,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.metricMonitorWritesEnabled
      ),
      metricRecommendationsEnabled: parseBoolean(
        env.CB_WORKSPACE_METRIC_RECOMMENDATIONS_ENABLED,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.metricRecommendationsEnabled
      ),
      plannerModel: env.CB_OPENAI_ORCHESTRATOR_PLANNER_MODEL
        || compatibilityModel
        || DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.plannerModel,
      plannerReasoningEffort: parseReasoningEffort(
        env.CB_OPENAI_ORCHESTRATOR_PLANNER_REASONING_EFFORT,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.plannerReasoningEffort
      ),
      plannerWorkerFallbackEnabled: parseBoolean(
        env.CB_WORKSPACE_PLANNER_WORKER_FALLBACK_ENABLED,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.plannerWorkerFallbackEnabled
      ),
      previewTtlSeconds: parseInteger(
        env.CB_WORKSPACE_CONTEXT_PREVIEW_TTL_SECONDS,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.previewTtlSeconds,
        60,
        600
      ),
      synthesisModel: env.CB_OPENAI_ORCHESTRATOR_SYNTHESIS_MODEL
        || compatibilityModel
        || DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.synthesisModel,
      synthesisReasoningEffort: parseReasoningEffort(
        env.CB_OPENAI_ORCHESTRATOR_SYNTHESIS_REASONING_EFFORT,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.synthesisReasoningEffort
      ),
      weakAttentionSignalsEnabled: parseBoolean(
        env.CB_WORKSPACE_WEAK_ATTENTION_SIGNALS_ENABLED,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.weakAttentionSignalsEnabled
      ),
      workerModel: env.CB_OPENAI_ORCHESTRATOR_WORKER_MODEL
        || compatibilityModel
        || DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.workerModel,
      workerReasoningEffort: parseReasoningEffort(
        env.CB_OPENAI_ORCHESTRATOR_WORKER_REASONING_EFFORT,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.workerReasoningEffort
      ),
      workspaceSummariesEnabled: parseBoolean(
        env.CB_WORKSPACE_SUMMARIES_ENABLED,
        DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY.workspaceSummariesEnabled
      ),
    },
  };
}

module.exports = {
  DEFAULT_DATASET_INTELLIGENCE_POLICY,
  DEFAULT_OBSERVATION_POLICY,
  DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY,
  getEnvIntelligencePolicy,
  parseBoolean,
  parseInteger,
  parseNumber,
  parsePositiveInteger,
  parseReasoningEffort,
};
