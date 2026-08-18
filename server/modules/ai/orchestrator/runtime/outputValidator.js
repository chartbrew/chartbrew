const CAUSAL_CLAIM_PATTERN = /\b(because|caused|causes|due to|led to|resulted from|responsible for)\b/i;
const STALE_AS_CURRENT_PATTERN = /\b(current|healthy|stable|up[ -]?to[ -]?date)\b/i;
const NUMERIC_TOKEN_PATTERN = /[-+]?\d[\d,]*(?:\.\d+)?%?/g;
const INTERNAL_REFERENCE_PATTERN = /\b(?:action|evidence|fact)_\d+\b|\bproject:\d+\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const CLAIM_PATTERNS = Object.freeze({
  active: /\bactive\b|\btriggered\b/i,
  negative: /\bdeclin(?:e|ed|ing)\b|\bdecreas(?:e|ed|ing)\b|\bfailed?\b|\bfailure\b|\blower\b|\bneeds attention\b/i,
  positive: /\bimprov(?:e|ed|ing)\b|\bincreas(?:e|ed|ing)\b|\bhigher\b|\bgrew\b/i,
  ready: /\bready\b|\bavailable\b|\bcomplete\b|\benabled\b/i,
  stable: /\bstable\b|\bunchanged\b|\bno meaningful change\b/i,
  waiting: /\bwaiting\b|\bcollecting\b|\bpartial\b|\bunavailable\b/i,
});
const ALLOWED_SECTION_TYPES = new Set([
  "account",
  "business_profile",
  "coverage",
  "dashboards",
  "datasets",
  "details",
  "kpi_result",
  "kpi_results",
  "kpi_reviews",
  "learning",
  "needs_attention",
  "prepared_change",
  "recent_alerts",
  "recommendations",
  "watched_metrics",
]);

function createOutputError(message, code = "OUTPUT_INVALID") {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function assertObjectKeys(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createOutputError(`${label} must be an object`);
  }
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw createOutputError(`${label} contains an unsupported field`);
  }
}

function getFact(factRegistry, factId) {
  return factRegistry instanceof Map ? factRegistry.get(factId) : factRegistry[factId];
}

function normalizeNumericToken(value) {
  const match = `${value}`.match(NUMERIC_TOKEN_PATTERN);
  return (match?.[0] || `${value}`).replace(/,/g, "").toLowerCase();
}

function getNumericTokens(value) {
  return (`${value}`.match(NUMERIC_TOKEN_PATTERN) || [])
    .map((token) => token.replace(/,/g, "").toLowerCase());
}

function assertNoInternalReferences(text) {
  if (INTERNAL_REFERENCE_PATTERN.test(text)) {
    throw createOutputError(
      "The answer contains an internal reference",
      "OUTPUT_INTERNAL_REFERENCE"
    );
  }
}

function validateClaimClasses(text, facts) {
  const supportedClasses = new Set(facts.flatMap((fact) => fact.claimClasses || []));
  Object.entries(CLAIM_PATTERNS).forEach(([claimClass, pattern]) => {
    if (pattern.test(text) && !supportedClasses.has(claimClass)) {
      throw createOutputError(
        "The answer contains a claim that its facts do not support",
        "OUTPUT_CLAIM_UNSUPPORTED"
      );
    }
  });
}

function validateTextAgainstFacts(text, facts) {
  assertNoInternalReferences(text);
  if (CAUSAL_CLAIM_PATTERN.test(text)) {
    throw createOutputError("The answer contains an unsupported causal claim", "OUTPUT_CAUSAL_CLAIM");
  }
  if (facts.some((fact) => fact.stale) && STALE_AS_CURRENT_PATTERN.test(text)) {
    throw createOutputError("The answer describes stale evidence as current", "OUTPUT_STALE_CLAIM");
  }
  const allowedValues = new Set(facts.flatMap((fact) => (
    fact.allowedTextValues || []
  )).flatMap(getNumericTokens));
  const numericTokens = text.match(NUMERIC_TOKEN_PATTERN) || [];
  numericTokens.forEach((token) => {
    if (!allowedValues.has(normalizeNumericToken(token))) {
      throw createOutputError(
        "The answer contains a value that is not in its facts",
        "OUTPUT_VALUE_UNSUPPORTED"
      );
    }
  });
  const requiredLabels = facts.flatMap((fact) => fact.requiredLabels || []);
  if (requiredLabels.length > 0
    && !requiredLabels.some((label) => text.includes(label))) {
    throw createOutputError(
      "The answer does not name its referenced subject",
      "OUTPUT_LABEL_UNSUPPORTED"
    );
  }
  validateClaimClasses(text, facts);
}

function validateStandaloneText(text, allowedTextValues) {
  assertNoInternalReferences(text);
  if (CAUSAL_CLAIM_PATTERN.test(text)) {
    throw createOutputError("The answer contains an unsupported causal claim", "OUTPUT_CAUSAL_CLAIM");
  }
  const allowedValues = new Set([...allowedTextValues].flatMap(getNumericTokens));
  (text.match(NUMERIC_TOKEN_PATTERN) || []).forEach((token) => {
    if (!allowedValues.has(normalizeNumericToken(token))) {
      throw createOutputError(
        "The answer contains a value that is not in its facts",
        "OUTPUT_VALUE_UNSUPPORTED"
      );
    }
  });
}

function validateFactRefs(factRefs, options, text) {
  if (!Array.isArray(factRefs) || factRefs.length !== 1) {
    throw createOutputError("Each factual item needs one exact fact reference");
  }
  const uniqueFactRefs = [...new Set(factRefs)];
  const facts = uniqueFactRefs.map((factId) => {
    if (typeof factId !== "string" || !options.accessibleFactIds.has(factId)) {
      throw createOutputError("The answer references an inaccessible fact", "OUTPUT_FACT_FORBIDDEN");
    }
    const fact = getFact(options.factRegistry, factId);
    if (!fact) {
      throw createOutputError("The answer references an unknown fact", "OUTPUT_FACT_UNKNOWN");
    }
    return fact;
  });
  validateTextAgainstFacts(text, facts);
  return uniqueFactRefs;
}

function validateAnswerItem(item, options) {
  assertObjectKeys(item, new Set(["factRefs", "text"]), "Answer item");
  if (typeof item.text !== "string" || !item.text.trim() || item.text.length > 500) {
    throw createOutputError("Answer text is not valid");
  }
  return {
    factRefs: validateFactRefs(item.factRefs, options, item.text),
    text: item.text.trim(),
  };
}

function validateAnswer(answer, options) {
  assertObjectKeys(answer, new Set(["coverageNote", "headline", "sections"]), "Answer");
  if (typeof answer.headline !== "string" || answer.headline.length > 240
    || typeof answer.coverageNote !== "string" || answer.coverageNote.length > 500
    || !Array.isArray(answer.sections) || answer.sections.length > 6) {
    throw createOutputError("The answer structure is not valid");
  }
  let itemCount = 0;
  const sections = answer.sections.map((section) => {
    assertObjectKeys(section, new Set(["items", "type"]), "Answer section");
    if (typeof section.type !== "string" || !ALLOWED_SECTION_TYPES.has(section.type)
      || !Array.isArray(section.items) || section.items.length > 20) {
      throw createOutputError("An answer section is not valid");
    }
    itemCount += section.items.length;
    return {
      items: section.items.map((item) => validateAnswerItem(item, options)),
      type: section.type,
    };
  });
  if (itemCount > 30) throw createOutputError("The answer contains too many factual items");
  validateStandaloneText(answer.headline, options.allowedSummaryTextValues);
  validateStandaloneText(answer.coverageNote, options.allowedSummaryTextValues);
  return {
    coverageNote: answer.coverageNote.trim(),
    headline: answer.headline.trim(),
    sections,
  };
}

function validateRecommendations(recommendations, options) {
  if (!Array.isArray(recommendations) || recommendations.length > 5) {
    throw createOutputError("The answer contains too many recommendations");
  }
  return recommendations.map((recommendation) => {
    assertObjectKeys(recommendation, new Set(["factRefs", "text"]), "Recommendation");
    if (typeof recommendation.text !== "string"
      || !recommendation.text.trim()
      || recommendation.text.length > 400) {
      throw createOutputError("The answer contains an ineligible recommendation");
    }
    const factRefs = validateFactRefs(recommendation.factRefs, options, recommendation.text);
    if (getFact(options.factRegistry, factRefs[0])?.factType !== "metric_recommendation") {
      throw createOutputError("The answer contains an ineligible recommendation");
    }
    return {
      factRefs,
      text: recommendation.text.trim(),
    };
  });
}

function validateSynthesisOutput(rawOutput, rawOptions = {}) {
  const options = {
    accessibleFactIds: new Set(rawOptions.accessibleFactIds || []),
    allowedSummaryTextValues: new Set(rawOptions.allowedSummaryTextValues || []),
    factRegistry: rawOptions.factRegistry || {},
  };
  assertObjectKeys(rawOutput, new Set([
    "answer",
    "contractVersion",
    "recommendations",
  ]), "Synthesis output");
  if (rawOutput.contractVersion !== 2) {
    throw createOutputError("The synthesis contract version is not supported");
  }
  return {
    answer: validateAnswer(rawOutput.answer, options),
    contractVersion: 2,
    recommendations: validateRecommendations(rawOutput.recommendations || [], options),
  };
}

module.exports = {
  ALLOWED_SECTION_TYPES,
  CAUSAL_CLAIM_PATTERN,
  CLAIM_PATTERNS,
  NUMERIC_TOKEN_PATTERN,
  STALE_AS_CURRENT_PATTERN,
  assertNoInternalReferences,
  createOutputError,
  getNumericTokens,
  normalizeNumericToken,
  validateSynthesisOutput,
  validateStandaloneText,
  validateClaimClasses,
  validateTextAgainstFacts,
};
