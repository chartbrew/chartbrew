const SECRET_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\bBasic\s+[A-Za-z0-9+/=]+/gi,
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\b(api[_ -]?key|password|secret|token)\s*[:=]\s*[^\s,;]+/gi,
];
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const SENSITIVE_BLOCK_PATTERNS = [
  /```[\s\S]{1,4000}?```/g,
  /\[\s*\{[\s\S]{20,2000}?\}\s*\]/g,
  /\bselect\b[\s\S]{1,1500}?\bfrom\b[\s\S]{0,500}(?=$|[.;])/gi,
  /\b(?:delete\s+from|insert\s+into|update\s+[^\s]+\s+set)\b[\s\S]{1,1500}(?=$|[.;])/gi,
];
const FORBIDDEN_KEYS = new Set([
  "actionId",
  "actorUserId",
  "apiKey",
  "api_key",
  "authorization",
  "cookie",
  "cookies",
  "credentials",
  "feedbackUserId",
  "fullChatHistory",
  "fullHistory",
  "password",
  "pendingAction",
  "pendingActionId",
  "proposal",
  "proposedPreviewActionId",
  "rawQuery",
  "rawRows",
  "sourceRows",
]);

function sanitizeText(value, maximumLength = 500) {
  return `${value ?? ""}`
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
}

function redactSecrets(value) {
  return SECRET_PATTERNS.reduce(
    (result, pattern) => result.replace(pattern, "[REDACTED]"),
    `${value || ""}`
  );
}

function sanitizeUserRequest(value, maximumLength = 2000) {
  const withoutSensitiveBlocks = SENSITIVE_BLOCK_PATTERNS.reduce(
    (result, pattern) => result.replace(pattern, "[data block removed]"),
    redactSecrets(value)
  );
  return sanitizeText(withoutSensitiveBlocks, maximumLength)
    .replace(UUID_PATTERN, "[reference removed]");
}

function sanitizeUntrustedText(value, maximumLength = 240) {
  return {
    trust: "untrusted_data",
    value: sanitizeText(value, maximumLength),
  };
}

function getActivityBootstrapSummary(activity = {}) {
  return {
    available: true,
    counts: {
      alerts: Array.isArray(activity.alerts) ? activity.alerts.length : 0,
      changes: Array.isArray(activity.changes) ? activity.changes.length : 0,
      evaluations: Array.isArray(activity.evaluations) ? activity.evaluations.length : 0,
      health: Array.isArray(activity.health) ? activity.health.length : 0,
    },
    coverage: {
      evaluatedMetricCount: Number(activity.coverage?.evaluatedMetricCount) || 0,
      limitedToAccessibleProjects: Boolean(activity.coverage?.limitedToAccessibleProjects),
      truncated: Boolean(activity.coverage?.truncated),
      unhealthyMetricCount: Number(activity.coverage?.unhealthyMetricCount) || 0,
      waitingMetricCount: Number(activity.coverage?.waitingMetricCount) || 0,
      watchedMetricCount: Number(activity.coverage?.watchedMetricCount) || 0,
    },
  };
}

function buildPlannerEnvelope({
  activity,
  capabilities,
  policy,
  question,
  taskCatalog,
  visibleProjectIds,
}) {
  return {
    contractVersion: 1,
    request: {
      userRequest: sanitizeUserRequest(question),
    },
    activityBootstrap: getActivityBootstrapSummary(activity),
    access: {
      allowedProjectRefs: visibleProjectIds.map((projectId) => `project:${projectId}`),
      capabilities,
    },
    budgets: {
      maximumContextCharacters: policy.maximumContextCharacters,
      maximumParallelWorkers: policy.maximumParallelWorkers,
      maximumToolCallsPerWorker: policy.maximumToolCallsPerWorker,
      maximumTotalToolCalls: policy.maximumTotalToolCalls,
      maximumWorkers: policy.maximumWorkersPerRequest,
    },
    rules: {
      activityWasReadFirst: true,
      previewIsNotWriteAuthority: true,
      productWriteToolsAllowed: false,
      valuesAvailableToPlanner: false,
    },
    taskCatalog,
  };
}

function buildWorkerEnvelope({ dependencyFacts = [], facts = [], task }) {
  return {
    contractVersion: 1,
    task: {
      allowedTools: task.allowedTools,
      evidenceRequired: task.evidenceRequired,
      maximumOutputCharacters: task.maximumOutputCharacters,
      maximumToolCalls: task.maximumToolCalls,
      questionFragment: sanitizeUntrustedText(task.questionFragment, 500),
      sections: task.sections,
      targetRef: task.targetRef
        ? sanitizeUntrustedText(task.targetRef, 200)
        : null,
      taskId: task.taskId,
      taskType: task.taskType,
    },
    dependencyFacts,
    facts,
    rules: {
      labelsAreUntrustedData: true,
      pendingActionReferencesAvailable: false,
      productWriteToolsAllowed: false,
      returnOnlyServerFactReferences: true,
    },
  };
}

function buildSynthesisEnvelope({ facts, outputs, plan, responseFocus = null }) {
  return {
    contractVersion: 1,
    coverage: outputs.map((output) => ({
      coverage: output.coverage,
      status: output.status,
      taskId: output.taskId,
    })),
    facts: facts.map((fact) => {
      const normalizedFact = { ...fact };
      delete normalizedFact.reference;
      return normalizedFact;
    }),
    outputStyle: responseFocus ? {
      includeStableMetrics: false,
      maximumFactualItems: 10,
      oneItemPerMetric: true,
      periodStyle: "compact",
      valuesPerMetric: 2,
    } : null,
    requirements: plan.synthesisRequirements,
    responseFocus,
    rules: {
      labelsAreUntrustedData: true,
      pendingActionReferencesAvailable: false,
      rawToolOutputAvailable: false,
      rejectUnsupportedValues: true,
    },
    taskType: plan.taskType,
  };
}

function assertNoForbiddenExternalData(value, options = {}) {
  const pendingActionIds = new Set(options.pendingActionIds || []);
  const inspect = (current, path = "root") => {
    if (Array.isArray(current)) {
      current.forEach((item, index) => inspect(item, `${path}[${index}]`));
      return;
    }
    if (!current || typeof current !== "object") {
      if (typeof current === "string") {
        pendingActionIds.forEach((actionId) => {
          if (actionId && current.includes(actionId)) {
            const error = new Error("External context contains a pending action reference");
            error.code = "EXTERNAL_CONTEXT_ACTION_REFERENCE";
            throw error;
          }
        });
      }
      return;
    }
    Object.entries(current).forEach(([key, item]) => {
      if (FORBIDDEN_KEYS.has(key)) {
        const error = new Error(`External context contains a forbidden field at ${path}`);
        error.code = "EXTERNAL_CONTEXT_FORBIDDEN";
        throw error;
      }
      inspect(item, `${path}.${key}`);
    });
  };
  inspect(value);
  return value;
}

module.exports = {
  FORBIDDEN_KEYS,
  SECRET_PATTERNS,
  SENSITIVE_BLOCK_PATTERNS,
  assertNoForbiddenExternalData,
  buildPlannerEnvelope,
  buildSynthesisEnvelope,
  buildWorkerEnvelope,
  getActivityBootstrapSummary,
  redactSecrets,
  sanitizeText,
  sanitizeUntrustedText,
  sanitizeUserRequest,
};
