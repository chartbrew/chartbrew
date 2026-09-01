const { sanitizeText, sanitizeUntrustedText } = require("./egressBoundary");
const {
  formatMetricValue,
  fromLegacyUnit,
} = require("../../../observations/valueFormat");

const NUMERIC_TOKEN_PATTERN = /[-+]?\d[\d,]*(?:\.\d+)?%?/g;

function cleanDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function cleanNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanValue(value, maximumLength = 240) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return value.toISOString();
  return sanitizeText(value, maximumLength);
}

function cleanRecord(value = {}, allowedKeys = []) {
  return allowedKeys.reduce((result, key) => {
    if (value[key] !== undefined) result[key] = cleanValue(value[key]);
    return result;
  }, {});
}

function getNumericTokens(value) {
  const tokens = [];
  const visit = (item) => {
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (item && typeof item === "object") {
      Object.values(item).forEach(visit);
      return;
    }
    if (typeof item === "number" && Number.isFinite(item)) {
      tokens.push(`${item}`);
      if (Math.abs(item) <= 1) tokens.push(`${item * 100}%`);
      return;
    }
    if (typeof item === "string") {
      tokens.push(...(item.match(NUMERIC_TOKEN_PATTERN) || []));
    }
  };
  visit(value);
  return [...new Set(tokens)];
}

function getClaimClasses(fact) {
  const values = [
    fact.state,
    fact.attributes?.completeness,
    fact.attributes?.direction,
    fact.attributes?.freshnessEffect,
    fact.attributes?.impact,
    fact.attributes?.status,
    fact.attributes?.statusReason,
  ].map((value) => `${value || ""}`.toLowerCase());
  const joined = values.join(" ");
  const classes = new Set();
  if (/positive|improved|increase|higher|resolved/.test(joined)) classes.add("positive");
  if (/negative|needs_attention|decrease|failed|failure|unhealthy|stale/.test(joined)) {
    classes.add("negative");
  }
  if (/no_meaningful_change|unchanged|stable/.test(joined)) classes.add("stable");
  if (/waiting|collecting|partial|unavailable/.test(joined)) classes.add("waiting");
  if (/ready|available|complete|enabled|final|revised/.test(joined)) classes.add("ready");
  if (/active/.test(joined)) classes.add("active");
  return [...classes];
}

function createFactStore(options = {}) {
  const visibleProjectIds = new Set((options.visibleProjectIds || []).map(Number));
  const entityReferences = new Map();
  const registry = new Map();
  let entitySequence = 0;
  let factSequence = 0;
  let evidenceSequence = 0;

  function createEntityReference(kind, value) {
    if (value === null || value === undefined || value === "") return null;
    entitySequence += 1;
    const reference = `entity_${entitySequence}`;
    entityReferences.set(reference, { kind, value });
    return reference;
  }

  function buildExternalReference(serverReferences = {}) {
    const reference = {};
    if (serverReferences.monitorId) {
      reference.monitorRef = createEntityReference("metric_monitor", serverReferences.monitorId);
    }
    if (serverReferences.recommendationId) {
      reference.recommendationRef = createEntityReference(
        "metric_recommendation",
        serverReferences.recommendationId
      );
    }
    if (serverReferences.subscriptionId) {
      reference.subscriptionRef = createEntityReference(
        "kpi_review",
        serverReferences.subscriptionId
      );
    }
    return Object.keys(reference).length > 0 ? reference : null;
  }

  function addFact(input) {
    factSequence += 1;
    evidenceSequence += 1;
    const factId = `fact_${factSequence}`;
    const evidenceRefs = [`evidence_${evidenceSequence}`];
    const projectId = cleanNumber(input.project?.id ?? input.projectId);
    if (projectId !== null && !visibleProjectIds.has(projectId)) {
      const error = new Error("A normalized fact is outside the current project scope");
      error.code = "FACT_PROJECT_FORBIDDEN";
      throw error;
    }
    const projectRef = projectId !== null && visibleProjectIds.has(projectId)
      ? `project:${projectId}`
      : null;
    const projectLabel = input.project?.name
      ? sanitizeUntrustedText(input.project.name, 160)
      : null;
    const label = input.label
      ? sanitizeUntrustedText(input.label, 160)
      : null;
    const detail = input.detail
      ? sanitizeUntrustedText(input.detail, 300)
      : null;
    const externalFact = {
      attributes: input.attributes || {},
      detail,
      evidenceRefs,
      factId,
      factType: input.factType,
      label,
      period: input.period || null,
      projectLabel,
      projectRef,
      reference: buildExternalReference(input.serverReferences),
      stale: Boolean(input.stale),
      state: sanitizeText(input.state || "available", 80),
      values: input.values || {},
    };
    const allowedTextValues = getNumericTokens(externalFact);
    const internalFact = {
      allowedTextValues,
      claimClasses: getClaimClasses(externalFact),
      evidenceRefs,
      externalFact,
      factId,
      factType: externalFact.factType,
      requiredLabels: label?.value ? [label.value] : [],
      stale: externalFact.stale,
      state: externalFact.state,
    };
    registry.set(factId, internalFact);
    return externalFact;
  }

  return {
    addFact,
    getExternalFacts(factIds = []) {
      return factIds.map((factId) => registry.get(factId)?.externalFact).filter(Boolean);
    },
    resolveEntityReference(reference, kind) {
      const resolved = entityReferences.get(reference);
      if (!resolved || resolved.kind !== kind) {
        const error = new Error("The worker returned an unknown entity reference");
        error.code = "WORKER_ENTITY_REFERENCE_FORBIDDEN";
        throw error;
      }
      return resolved.value;
    },
    registry,
  };
}

function normalizeActivity(result, store) {
  const facts = [];
  (result.changes || []).forEach((item) => {
    facts.push(store.addFact({
      attributes: {
        calendarTimezone: cleanValue(item.calendarTimezone),
        direction: cleanValue(item.direction),
        finality: cleanValue(item.finality),
        impact: cleanValue(item.impact),
        observedAt: cleanDate(item.observedAt),
        severity: cleanValue(item.severity),
      },
      detail: item.summary,
      factType: "metric_change",
      label: item.metricName || item.title,
      period: {
        comparison: cleanRecord(item.comparisonPeriod, ["end", "start"]),
        current: cleanRecord(item.currentPeriod, ["end", "start"]),
        label: cleanValue(item.comparisonLabel),
      },
      project: item.project,
      state: item.finality || "final",
      values: {
        absoluteDelta: cleanNumber(item.absoluteDelta),
        baseline: cleanNumber(item.baselineValue),
        baselineDisplay: cleanValue(formatMetricValue(
          item.baselineValue,
          fromLegacyUnit(item.unit)
        )),
        current: cleanNumber(item.currentValue),
        currentDisplay: cleanValue(formatMetricValue(
          item.currentValue,
          fromLegacyUnit(item.unit)
        )),
        relativeDelta: cleanNumber(item.relativeDelta),
        unit: cleanValue(item.unit),
      },
    }));
  });
  (result.evaluations || []).forEach((item) => {
    facts.push(store.addFact({
      attributes: {
        calendarTimezone: cleanValue(item.calendarTimezone),
        completeness: cleanValue(item.completeness),
        direction: cleanValue(item.direction),
        evaluatedAt: cleanDate(item.evaluatedAt),
        finality: cleanValue(item.finality),
        impact: cleanValue(item.impact),
        material: Boolean(item.material),
        status: cleanValue(item.status),
      },
      factType: "metric_evaluation",
      label: item.metricName,
      period: {
        comparison: cleanRecord(item.comparisonPeriod, ["end", "start"]),
        current: cleanRecord(item.currentPeriod, ["end", "start"]),
        label: cleanValue(item.comparisonLabel),
      },
      project: item.project,
      stale: item.stale,
      state: item.finality || "final",
      values: {
        absoluteDelta: cleanNumber(item.absoluteDelta),
        baseline: cleanNumber(item.baselineValue),
        baselineDisplay: cleanValue(formatMetricValue(
          item.baselineValue,
          item.valueFormat
        )),
        current: cleanNumber(item.currentValue),
        currentDisplay: cleanValue(formatMetricValue(
          item.currentValue,
          item.valueFormat
        )),
        relativeDelta: cleanNumber(item.relativeDelta),
      },
    }));
  });
  (result.health || []).forEach((item) => {
    facts.push(store.addFact({
      attributes: {
        detectedAt: cleanDate(item.detectedAt),
        freshnessEffect: cleanValue(item.freshnessEffect),
        resolvedAt: cleanDate(item.resolvedAt),
        type: cleanValue(item.type),
      },
      detail: item.message,
      factType: "data_health",
      label: item.title,
      project: item.project,
      stale: item.state === "active" && Boolean(item.freshnessEffect),
      state: item.state || "active",
    }));
  });
  (result.alerts || []).forEach((item) => {
    facts.push(store.addFact({
      attributes: {
        lastTriggeredAt: cleanDate(item.lastTriggeredAt),
      },
      factType: "alert",
      label: item.name,
      project: item.project,
      state: item.state || "active",
    }));
  });
  facts.push(store.addFact({
    attributes: {
      evaluatedMetricCount: cleanNumber(result.coverage?.evaluatedMetricCount) || 0,
      limitedToAccessibleProjects: Boolean(result.coverage?.limitedToAccessibleProjects),
      rangeFrom: cleanDate(result.range?.from),
      rangeTo: cleanDate(result.range?.to),
      truncated: Boolean(result.coverage?.truncated),
      unhealthyMetricCount: cleanNumber(result.coverage?.unhealthyMetricCount) || 0,
      waitingMetricCount: cleanNumber(result.coverage?.waitingMetricCount) || 0,
      watchedMetricCount: cleanNumber(result.coverage?.watchedMetricCount) || 0,
    },
    factType: "coverage",
    state: result.coverage?.truncated ? "partial" : "complete",
  }));
  return facts;
}

function normalizeWatches(items, store) {
  return items.map((item) => store.addFact({
    attributes: {
      active: item.active !== false,
      canEdit: Boolean(item.canEdit),
      comparison: cleanValue(item.comparison?.period || item.comparison),
      desiredDirection: cleanValue(item.desiredDirection),
      importance: cleanNumber(item.importance),
      metricBehavior: cleanValue(item.metricBehavior),
      statusReason: cleanValue(item.statusReason),
      thresholdType: cleanValue(item.threshold?.type),
      thresholdValue: cleanNumber(item.threshold?.value),
    },
    factType: "metric_monitor",
    label: item.name,
    project: item.project || { id: item.projectId },
    serverReferences: { monitorId: item.id },
    state: item.status || "available",
  }));
}

function normalizeKpiReviews(items, store) {
  return items.map((item) => store.addFact({
    attributes: {
      cadence: cleanValue(item.cadence),
      contentMode: cleanValue(item.contentMode),
      dayOfMonth: cleanNumber(item.dayOfMonth),
      dayOfWeek: cleanNumber(item.dayOfWeek),
      enabled: item.enabled !== false,
      localDeliveryTime: cleanValue(item.localDeliveryTime),
      nextDeliveryAt: cleanDate(item.nextDeliveryAt),
      timezone: cleanValue(item.timezone),
    },
    factType: "kpi_review",
    label: item.scope?.name || "KPI review",
    projectId: item.scope?.projectId || item.projectId,
    serverReferences: { subscriptionId: item.id },
    state: item.enabled === false ? "disabled" : "enabled",
  }));
}

function normalizeRecommendations(items, store) {
  return items.map((item) => store.addFact({
    attributes: {
      calculation: cleanValue(item.calculation),
      comparison: cleanValue(item.comparison),
      metricBehavior: cleanValue(item.recommendedMetricBehavior),
      reasons: (item.reasons || []).slice(0, 2).map((reason) => sanitizeUntrustedText(reason, 180)),
    },
    factType: "metric_recommendation",
    label: item.name,
    project: item.project,
    serverReferences: { recommendationId: item.id },
    state: "eligible",
  }));
}

function normalizeDashboards(items, store) {
  return items.map((item) => store.addFact({
    attributes: {
      chartCount: cleanNumber(item.chartCount) || 0,
      lastUpdatedAt: cleanDate(item.lastUpdatedAt),
      pinned: Boolean(item.pinned),
    },
    factType: "dashboard",
    label: item.name,
    projectId: item.id,
    state: "available",
  }));
}

function normalizeDatasets(items, store) {
  return items.map((item) => store.addFact({
    attributes: {
      hasReadyProfile: Boolean(item.profile),
      primaryTimeField: item.profile?.primaryTimeField
        ? sanitizeUntrustedText(item.profile.primaryTimeField, 160)
        : null,
      updatedAt: cleanDate(item.updatedAt),
    },
    factType: "dataset",
    label: item.name,
    state: "available",
  }));
}

function normalizeLearning(items, store) {
  return items.map((item) => store.addFact({
    attributes: {
      reasonCode: cleanValue(item.decision?.reasonCode),
      signalType: cleanValue(item.signalType),
      strength: cleanValue(item.strength),
      verdict: cleanValue(item.decision?.verdict),
    },
    factType: "learning_signal",
    state: item.strength || "context",
  }));
}

function normalizeAccount(account, store) {
  if (!account) return [];
  return [store.addFact({
    attributes: {
      aiAvailable: Boolean(account.aiAvailable),
      canConfigureConnections: Boolean(account.canConfigureConnections),
      canEditWatchedMetrics: Boolean(account.canEditWatchedMetrics),
      canConfirmKpiReview: Boolean(account.canConfirmKpiReview),
      canConfirmWatchedMetric: Boolean(account.canConfirmWatchedMetric),
      canSchedulePersonalReview: Boolean(account.canSchedulePersonalReview),
      hasDeliveryEmail: Boolean(account.hasDeliveryEmail),
    },
    factType: "account_capability",
    state: "available",
  })];
}

function normalizeBusinessProfile(profile, store) {
  if (!profile) return [];
  const metadata = profile.metadata && typeof profile.metadata === "object"
    ? profile.metadata
    : {};
  return [store.addFact({
    attributes: {
      description: cleanValue(profile.description, 1000),
      domain: cleanValue(profile.domain),
      industry: cleanValue(metadata.industry),
      language: cleanValue(metadata.language),
      useCases: cleanValue(profile.useCases, 500),
    },
    factType: "business_profile",
    label: profile.businessName,
    state: "approved",
  })];
}

function normalizePreview(toolName, result, store) {
  const preview = result.preview || {};
  const actionType = toolName === "preview_metric_monitor"
    ? `metric_monitor.${preview.action || "create"}`
    : `kpi_review.${preview.action || "create"}`;
  const label = toolName === "preview_metric_monitor"
    ? preview.name || preview.calculation
    : preview.scopeLabel || "KPI review";
  return [store.addFact({
    attributes: toolName === "preview_metric_monitor" ? {
      actionType,
      calculation: cleanValue(preview.calculation),
      calculationBehaviorLabel: cleanValue(preview.calculationBehaviorLabel),
      comparisonLabel: cleanValue(preview.comparisonLabel),
      firstResultState: cleanValue(preview.firstResultState),
      healthyDirectionLabel: cleanValue(preview.healthyDirectionLabel),
      sourceChart: preview.source?.chart
        ? sanitizeUntrustedText(preview.source.chart, 160)
        : null,
      sourceDashboard: preview.source?.dashboard
        ? sanitizeUntrustedText(preview.source.dashboard, 160)
        : null,
      thresholdLabel: cleanValue(preview.thresholdLabel),
    } : {
      actionType,
      activeHealthCount: cleanNumber(preview.activeHealthCount) || 0,
      contentModeLabel: cleanValue(preview.contentModeLabel),
      eligibleMetricCount: cleanNumber(preview.eligibleMetricCount) || 0,
      nextDeliveryAt: cleanDate(preview.nextDeliveryAt),
      scheduleLabel: cleanValue(preview.scheduleLabel),
      timezone: cleanValue(preview.timezone),
      waitingMetricCount: cleanNumber(preview.waitingMetricCount) || 0,
    },
    factType: "action_preview",
    label,
    state: "ready_for_confirmation",
  })];
}

function boundFacts(facts, maximumCharacters) {
  const selected = [];
  let truncated = false;
  for (const fact of facts) {
    const candidate = [...selected, fact];
    if (JSON.stringify(candidate).length > maximumCharacters) {
      truncated = true;
      break;
    }
    selected.push(fact);
  }
  return { facts: selected, truncated };
}

function normalizeToolResult(toolName, result = {}, store, options = {}) {
  let facts = [];
  if (toolName === "get_workspace_activity") facts = normalizeActivity(result, store);
  if (toolName === "list_metric_monitors") facts = normalizeWatches(result.items || [], store);
  if (toolName === "list_kpi_reviews") facts = normalizeKpiReviews(result.items || [], store);
  if (toolName === "recommend_metric_monitors") {
    facts = normalizeRecommendations(result.items || [], store);
  }
  if (["preview_kpi_review", "preview_metric_monitor"].includes(toolName)) {
    facts = normalizePreview(toolName, result, store);
  }
  if (toolName === "get_workspace_context") {
    facts = [
      ...normalizeWatches(result.watches || [], store),
      ...normalizeKpiReviews(result.kpiReviews || [], store),
      ...normalizeDashboards(result.dashboards || [], store),
      ...normalizeDatasets(result.datasets || [], store),
      ...normalizeLearning(result.learning || [], store),
      ...normalizeAccount(result.account, store),
      ...normalizeBusinessProfile(result.business_profile, store),
    ];
  }
  const bounded = boundFacts(facts, options.maximumCharacters || 12000);
  return {
    coverage: {
      complete: !(result.truncated || result.coverage?.truncated || bounded.truncated),
      missingEvidence: [],
      truncated: Boolean(result.truncated || result.coverage?.truncated || bounded.truncated),
    },
    facts: bounded.facts,
    previewPrepared: ["preview_kpi_review", "preview_metric_monitor"].includes(toolName)
      && result.status === "ready_for_confirmation",
    toolStatus: result.error ? "failed" : "complete",
  };
}

module.exports = {
  NUMERIC_TOKEN_PATTERN,
  boundFacts,
  cleanDate,
  cleanNumber,
  createFactStore,
  getNumericTokens,
  getClaimClasses,
  normalizeToolResult,
};
