const DEFAULT_LIMITS = Object.freeze({
  alerts: 10,
  dashboards: 10,
  datasets: 5,
  evaluations: 30,
  health: 10,
  kpiReviews: 10,
  learning: 12,
  learningCharacters: 6000,
  observations: 20,
  totalCharacters: 30000,
  watches: 50,
});

const HARD_LIMITS = Object.freeze({
  alerts: 25,
  dashboards: 25,
  datasets: 20,
  evaluations: 100,
  health: 25,
  kpiReviews: 10,
  learning: 30,
  learningCharacters: 12000,
  observations: 50,
  totalCharacters: 60000,
  watches: 100,
});

function parseBoundedInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  const resolved = Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  return Math.min(resolved, maximum);
}

function getContextLimits(overrides = {}) {
  return {
    ...DEFAULT_LIMITS,
    ...Object.fromEntries(Object.keys(DEFAULT_LIMITS).map((key) => [
      key,
      parseBoundedInteger(overrides[key], DEFAULT_LIMITS[key], HARD_LIMITS[key]),
    ])),
    learning: parseBoundedInteger(
      overrides.learning || process.env.CB_WORKSPACE_LEARNING_MAX_ITEMS,
      DEFAULT_LIMITS.learning,
      HARD_LIMITS.learning
    ),
    learningCharacters: parseBoundedInteger(
      overrides.learningCharacters || process.env.CB_WORKSPACE_LEARNING_MAX_CHARACTERS,
      DEFAULT_LIMITS.learningCharacters,
      HARD_LIMITS.learningCharacters
    ),
    totalCharacters: parseBoundedInteger(
      overrides.totalCharacters || process.env.CB_WORKSPACE_CONTEXT_MAX_CHARACTERS,
      DEFAULT_LIMITS.totalCharacters,
      HARD_LIMITS.totalCharacters
    ),
  };
}

function getSerializedCharacterCount(value) {
  return JSON.stringify(value).length;
}

function truncateContextSections(context, maximumCharacters) {
  const result = { ...context };
  const arrayKeys = [
    "learning",
    "datasets",
    "dashboards",
    "kpiReviews",
    "alerts",
    "health",
    "watches",
  ];
  let truncated = false;
  while (getSerializedCharacterCount(result) > maximumCharacters) {
    const key = arrayKeys.find((candidate) => Array.isArray(result[candidate])
      && result[candidate].length > 0);
    if (!key) break;
    result[key] = result[key].slice(0, -1);
    truncated = true;
  }
  return {
    context: result,
    characterCount: getSerializedCharacterCount(result),
    truncated,
  };
}

module.exports = {
  DEFAULT_LIMITS,
  HARD_LIMITS,
  getContextLimits,
  getSerializedCharacterCount,
  parseBoundedInteger,
  truncateContextSections,
};
