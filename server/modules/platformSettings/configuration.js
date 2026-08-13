const { getAnalysisDepthPreset } = require("../intelligence/orchestratorPresets");

const PLATFORM_SETTING_GROUPS = Object.freeze([
  { id: "aiControls", label: "AI controls" },
  { id: "reporting", label: "Reporting and actions" },
  { id: "advanced", label: "Advanced AI limits" },
]);

const PLATFORM_SETTING_DEFINITIONS = Object.freeze([
  {
    key: "workspaceOrchestrator.enabled",
    group: "aiControls",
    label: "Enable Chartbrew AI",
    description: "Let permitted users ask Chartbrew about existing workspace data and metrics.",
    help: "When an external AI provider is configured, Chartbrew sends only the permitted information needed for each question. User and project permissions still apply.",
    type: "boolean",
  },
  {
    key: "workspaceOrchestrator.externalLearningContextEnabled",
    group: "aiControls",
    label: "Allow feedback with external AI",
    description: "Use relevant feedback and corrections in external AI answers.",
    help: "This permission is separate from workspace data access because feedback can contain additional business context.",
    requiresProvider: true,
    type: "boolean",
  },
  {
    key: "workspaceOrchestrator.learningRetrievalEnabled",
    group: "aiControls",
    label: "Learn from feedback",
    description: "Use saved feedback and corrections to improve later answers.",
    help: "For example, Chartbrew can reuse a correction about what a metric means in a later report for the same team.",
    type: "boolean",
  },
  {
    key: "workspaceOrchestrator.weakAttentionSignalsEnabled",
    group: "aiControls",
    label: "Use workspace choices",
    description: "Use pins, saved choices, and refresh schedules to make answers more relevant.",
    help: "These choices are only relevance hints. Chartbrew does not treat them as proof that a metric is important or correct.",
    type: "boolean",
  },
  {
    key: "workspaceOrchestrator.workspaceSummariesEnabled",
    group: "reporting",
    label: "Workspace summaries",
    description: "Let AI summarize changes from information a user can access.",
    type: "boolean",
  },
  {
    key: "workspaceOrchestrator.metricRecommendationsEnabled",
    group: "reporting",
    label: "Metric watch recommendations",
    description: "Let AI suggest existing metrics that may be useful to watch.",
    help: "A recommendation does not create a watch. A permitted user must review and confirm it first.",
    type: "boolean",
  },
  {
    key: "workspaceOrchestrator.metricMonitorWritesEnabled",
    group: "reporting",
    label: "Allow confirmed metric watch changes",
    description: "Let permitted users confirm metric watch changes prepared by AI.",
    help: "AI can prepare the change, but it cannot apply it until the user reviews and confirms the preview.",
    type: "boolean",
  },
  {
    key: "workspaceOrchestrator.kpiReviewWritesEnabled",
    group: "reporting",
    label: "Allow confirmed report schedule changes",
    description: "Let permitted users confirm scheduled report changes prepared by AI.",
    help: "AI can prepare a weekly or monthly schedule, but it cannot apply it until the user reviews and confirms the preview.",
    type: "boolean",
  },
  {
    key: "workspaceOrchestrator.maximumSummaryLookbackDays",
    group: "reporting",
    label: "Maximum reporting period",
    description: "Set how far a workspace summary can look back.",
    type: "integer",
    minimum: 30,
    maximum: 3650,
    unit: "days",
  },
  {
    key: "workspaceOrchestrator.maximumModelTokensPerRequest",
    group: "advanced",
    label: "AI capacity per request",
    description: "Set the maximum AI capacity for one question.",
    help: "AI providers measure text and reasoning in tokens. This is a ceiling, not a usage target. Simple questions usually use much less.",
    type: "integer",
    minimum: 10000,
    maximum: 250000,
    unit: "tokens",
  },
  {
    key: "workspaceOrchestrator.maximumRequestTimeSeconds",
    group: "advanced",
    label: "Maximum answer time",
    description: "Set how long Chartbrew can work on one question.",
    help: "Longer limits give broad reports more time to inspect relevant workspace evidence.",
    type: "integer",
    minimum: 15,
    maximum: 300,
    unit: "seconds",
  },
  {
    key: "workspaceOrchestrator.analysisDepth",
    group: "advanced",
    label: "Analysis depth",
    description: "Choose how much evidence Chartbrew can inspect for a question.",
    help: "Standard supports focused questions. Thorough can inspect more workspace areas. Extended is for broad reports and can take longer.",
    type: "enum",
    options: [
      { value: "standard", label: "Standard" },
      { value: "thorough", label: "Thorough" },
      { value: "extended", label: "Extended" },
    ],
  },
]);

const DEFINITION_BY_KEY = new Map(
  PLATFORM_SETTING_DEFINITIONS.map((definition) => [definition.key, definition])
);

function getPathValue(object, path) {
  return path.split(".").reduce((value, segment) => value?.[segment], object);
}

function setPathValue(object, path, value) {
  const segments = path.split(".");
  const leaf = segments.pop();
  const parent = segments.reduce((current, segment) => {
    if (!current[segment]) current[segment] = {};
    return current[segment];
  }, object);
  parent[leaf] = value;
}

function validateSettingValue(key, value) {
  const definition = DEFINITION_BY_KEY.get(key);
  if (!definition) {
    const error = new Error(`Unknown platform setting: ${key}`);
    error.statusCode = 400;
    throw error;
  }

  if (definition.type === "boolean") {
    if (typeof value !== "boolean") {
      const error = new Error(`${definition.label} must be true or false`);
      error.statusCode = 400;
      throw error;
    }
    return value;
  }

  if (definition.type === "enum") {
    if (!definition.options.some((option) => option.value === value)) {
      const error = new Error(`${definition.label} has an invalid value`);
      error.statusCode = 400;
      throw error;
    }
    return value;
  }

  const emptyValue = value === "" || value === null || value === undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  const validNumber = !emptyValue
    && typeof value !== "boolean"
    && Number.isFinite(parsed)
    && (definition.type !== "integer" || Number.isInteger(parsed))
    && parsed >= definition.minimum
    && parsed <= definition.maximum;
  if (!validNumber) {
    const error = new Error(
      `${definition.label} must be between ${definition.minimum} and ${definition.maximum}`
    );
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

function applyPlatformSettingOverrides(basePolicy, overrides = {}) {
  const policy = {
    datasetIntelligence: { ...basePolicy.datasetIntelligence },
    observations: { ...basePolicy.observations },
    workspaceOrchestrator: { ...basePolicy.workspaceOrchestrator },
  };
  Object.entries(overrides).forEach(([key, value]) => {
    if (!DEFINITION_BY_KEY.has(key)) return;
    const validatedValue = validateSettingValue(key, value);
    setPathValue(policy, key, validatedValue);
    if (key === "workspaceOrchestrator.maximumRequestTimeSeconds") {
      policy.workspaceOrchestrator.maximumRequestTimeMs = validatedValue * 1000;
    }
    if (key === "workspaceOrchestrator.analysisDepth") {
      Object.assign(
        policy.workspaceOrchestrator,
        getAnalysisDepthPreset(validatedValue)
      );
    }
  });
  return policy;
}

module.exports = {
  PLATFORM_SETTING_DEFINITIONS,
  PLATFORM_SETTING_GROUPS,
  applyPlatformSettingOverrides,
  getPathValue,
  validateSettingValue,
};
