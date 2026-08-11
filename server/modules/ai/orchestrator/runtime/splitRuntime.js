const { buildContextManifest } = require("../../../workspaceContext/contextManifest");
const { escapeMarkdown } = require("../../../workspaceContext/deterministicSummary");
const { getWorkspaceAccessEnvelope } = require("../../../workspaceContext/accessEnvelope");
const { getWorkspaceOrchestratorPolicy } = require("../../../workspaceContext/policy");
const { clearPendingActions } = require("../../../workspaceContext/previewStore");
const { readWorkspaceActivity } = require("../../../workspaceContext/workspaceActivityProjection");
const { dispatchPlan } = require("./dispatcher");
const { runDeterministicWorkspaceRequest } = require("./deterministicExecutor");
const { routeWorkspaceRequest } = require("./deterministicRouter");
const {
  assertNoForbiddenExternalData,
  buildPlannerEnvelope,
  buildSynthesisEnvelope,
  buildWorkerEnvelope,
} = require("./egressBoundary");
const {
  boundFacts,
  createFactStore,
  normalizeToolResult,
} = require("./factNormalizer");
const { validateSynthesisOutput } = require("./outputValidator");
const {
  PREVIEW_TOOLS,
  READ_TOOLS,
  TOOL_SECTIONS,
  validatePlannerPlan,
} = require("./planValidator");
const {
  callProviderRole,
  createProviderBudget,
  getResponseJson,
  getResponseToolCalls,
} = require("./providerClient");
const {
  PLANNER_SCHEMA,
  SYNTHESIS_SCHEMA,
  WORKER_SCHEMA,
} = require("./responseSchemas");
const { validateWorkerOutput } = require("./workerContract");
const {
  AI_ACCESS_MODES,
  VIEWER_REPORTING_AI_TOOLS,
} = require("../rolePolicy");

const SPLIT_RUNTIME_TOOLS = new Set([
  ...READ_TOOLS,
  ...PREVIEW_TOOLS,
]);
const SECTION_TYPES = Object.freeze({
  account_capability: "account",
  action_preview: "prepared_change",
  alert: "recent_alerts",
  coverage: "coverage",
  dashboard: "dashboards",
  data_health: "needs_attention",
  dataset: "datasets",
  kpi_review: "kpi_reviews",
  learning_signal: "learning",
  metric_change: "kpi_results",
  metric_evaluation: "kpi_results",
  metric_monitor: "watched_metrics",
  metric_recommendation: "recommendations",
});
const TOOL_REFERENCE_FIELDS = Object.freeze({
  preview_kpi_review: [{
    external: "subscription_ref",
    internal: "subscription_id",
    kind: "kpi_review",
  }],
  preview_metric_monitor: [{
    external: "monitor_ref",
    internal: "monitor_id",
    kind: "metric_monitor",
  }, {
    external: "recommendation_ref",
    internal: "recommendation_id",
    kind: "metric_recommendation",
  }],
});

function getAllowedSplitToolNames({ envelope, options, policy }) {
  const reportingOnly = options.aiAccessMode === AI_ACCESS_MODES.REPORTING_ONLY;
  let configuredTools = SPLIT_RUNTIME_TOOLS;
  if (reportingOnly) {
    configuredTools = new Set(VIEWER_REPORTING_AI_TOOLS);
  } else if (Array.isArray(options.allowedToolNames)) {
    configuredTools = new Set(options.allowedToolNames);
  }
  const allowed = new Set([...SPLIT_RUNTIME_TOOLS].filter((tool) => configuredTools.has(tool)));
  if (!options.aiSessionId) {
    allowed.delete("preview_kpi_review");
    allowed.delete("preview_metric_monitor");
  }
  if (envelope.editableProjectIds.length === 0) {
    allowed.delete("preview_metric_monitor");
    allowed.delete("recommend_metric_monitors");
  }
  if (!policy.metricRecommendationsEnabled) allowed.delete("recommend_metric_monitors");
  if (!envelope.canCreatePersonalKpiReview) allowed.delete("preview_kpi_review");
  return allowed;
}

function getTaskCatalog(allowedToolNames) {
  return [{
    allowedSections: [...(TOOL_SECTIONS.get("get_workspace_activity") || [])],
    allowedTools: allowedToolNames.has("get_workspace_activity")
      ? ["get_workspace_activity"]
      : [],
    taskType: "read_workspace_section",
  }, {
    allowedSections: [...(TOOL_SECTIONS.get("get_workspace_context") || [])],
    allowedTools: allowedToolNames.has("get_workspace_context")
      ? ["get_workspace_context"]
      : [],
    taskType: "read_workspace_section",
  }, {
    allowedSections: ["watches"],
    allowedTools: allowedToolNames.has("list_metric_monitors")
      ? ["list_metric_monitors"]
      : [],
    taskType: "read_workspace_section",
  }, {
    allowedSections: ["kpiReviews"],
    allowedTools: allowedToolNames.has("list_kpi_reviews")
      ? ["list_kpi_reviews"]
      : [],
    taskType: "read_workspace_section",
  }, {
    allowedSections: ["watches"],
    allowedTools: allowedToolNames.has("recommend_metric_monitors")
      ? ["recommend_metric_monitors"]
      : [],
    taskType: "recommend_metric_monitors",
  }, {
    allowedSections: ["watches"],
    allowedTools: allowedToolNames.has("preview_metric_monitor")
      ? ["preview_metric_monitor"]
      : [],
    taskType: "preview_metric_monitor",
  }, {
    allowedSections: ["account", "kpiReviews"],
    allowedTools: allowedToolNames.has("preview_kpi_review")
      ? ["preview_kpi_review"]
      : [],
    taskType: "preview_kpi_review",
  }].filter((entry) => entry.allowedTools.length > 0);
}

function getCapabilities(envelope, options = {}) {
  const reportingOnly = options.aiAccessMode === AI_ACCESS_MODES.REPORTING_ONLY;
  return {
    canPreviewKpiReview: !reportingOnly && envelope.canCreatePersonalKpiReview,
    canPreviewMetricMonitor: !reportingOnly && envelope.editableProjectIds.length > 0,
    canWriteKpiReview: !reportingOnly && envelope.kpiReviewWritesEnabled,
    canWriteMetricMonitor: !reportingOnly && envelope.metricMonitorWritesEnabled
      && envelope.editableProjectIds.length > 0,
    reportingOnly,
  };
}

function getWorkerToolDefinition(definition) {
  const parameters = JSON.parse(JSON.stringify(definition.parameters || {
    type: "object",
    properties: {},
  }));
  const referenceFields = TOOL_REFERENCE_FIELDS[definition.name] || [];
  referenceFields.forEach(({ external, internal }) => {
    if (!parameters.properties?.[internal]) return;
    parameters.properties[external] = {
      description: "Request-local reference from the assigned worker facts.",
      type: "string",
    };
    delete parameters.properties[internal];
    if (Array.isArray(parameters.required)) {
      parameters.required = parameters.required.map((field) => (
        field === internal ? external : field
      ));
    }
  });
  return {
    description: definition.description,
    name: definition.name,
    parameters,
    strict: false,
    type: "function",
  };
}

function buildWorkerTools(task, definitionsByName) {
  return task.allowedTools.map((name) => {
    const definition = definitionsByName.get(name);
    if (!definition) {
      const error = new Error("The worker tool is not available");
      error.code = "WORKER_TOOL_UNAVAILABLE";
      throw error;
    }
    return getWorkerToolDefinition(definition);
  });
}

function parseToolArguments(toolCall, definition) {
  let args;
  try {
    args = JSON.parse(toolCall.arguments || "{}");
  } catch (_error) {
    const error = new Error("The worker returned invalid tool arguments");
    error.code = "WORKER_TOOL_ARGUMENTS_INVALID";
    throw error;
  }
  if (!args || typeof args !== "object" || Array.isArray(args)
    || JSON.stringify(args).length > 8000) {
    const error = new Error("The worker returned invalid tool arguments");
    error.code = "WORKER_TOOL_ARGUMENTS_INVALID";
    throw error;
  }
  const allowedKeys = new Set(Object.keys(definition.parameters?.properties || {}));
  if (Object.keys(args).some((key) => !allowedKeys.has(key))) {
    const error = new Error("The worker requested an unsupported tool field");
    error.code = "WORKER_TOOL_ARGUMENTS_FORBIDDEN";
    throw error;
  }
  return args;
}

function assertProjectFilter(args, envelope) {
  if (args.project_id === undefined) return;
  const projectId = Number(args.project_id);
  if (!Number.isInteger(projectId) || !envelope.visibleProjectIds.includes(projectId)) {
    const error = new Error("The worker requested an inaccessible project");
    error.code = "WORKER_PROJECT_FORBIDDEN";
    throw error;
  }
}

function getPendingAction(toolName, result) {
  if (!PREVIEW_TOOLS.has(toolName)
    || result.status !== "ready_for_confirmation"
    || !result.actionId
    || !result.preview) {
    return null;
  }
  return {
    actionId: result.actionId,
    actionType: toolName === "preview_metric_monitor"
      ? `metric_monitor.${result.preview.action}`
      : `kpi_review.${result.preview.action}`,
    expiresAt: result.expiresAt,
    preview: result.preview,
    status: result.status,
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
  };
}

function buildScopedToolPayload({
  access,
  args,
  options,
  question,
  store,
  task,
  toolName,
}) {
  const payload = { ...args };
  (TOOL_REFERENCE_FIELDS[toolName] || []).forEach(({ external, internal, kind }) => {
    if (!payload[external]) return;
    payload[internal] = store.resolveEntityReference(payload[external], kind);
    delete payload[external];
  });
  if (toolName === "get_workspace_context") {
    payload.sections = task.sections.filter((section) => (
      TOOL_SECTIONS.get("get_workspace_context").has(section)
    ));
  }
  payload.team_id = access.teamId;
  payload.user_id = access.userId;
  if (Array.isArray(options.allowedProjectIds)) {
    payload.allowed_project_ids = options.allowedProjectIds;
  }
  if (PREVIEW_TOOLS.has(toolName)) payload.ai_session_id = options.aiSessionId;
  if (PREVIEW_TOOLS.has(toolName)) payload.original_question = question;
  return payload;
}

function getExternalFactsForTask({ bootstrapFacts, dependencyFacts, task }) {
  const needsBootstrap = task.sections.some((section) => (
    ["activity", "alerts", "health"].includes(section)
  ));
  return {
    dependencyFacts,
    facts: needsBootstrap ? bootstrapFacts : [],
  };
}

function getAccessibleFacts(outputs, bootstrapFacts, plan, store) {
  const ids = new Set();
  if (plan.answerCanUseBootstrapOnly || plan.taskType === "workspace_summary") {
    bootstrapFacts.forEach((fact) => ids.add(fact.factId));
  }
  outputs.forEach((output) => output.facts.forEach((fact) => ids.add(fact.factId)));
  return store.getExternalFacts([...ids]);
}

function renderSynthesis(output, pendingAction, plan, outputs = []) {
  const titles = {
    kpi_review_preview: "KPI review preview",
    watch_preview: "Watched metric preview",
    watch_recommendation: "Metrics to consider",
    workspace_question: "Workspace answer",
    workspace_summary: "Workspace update",
  };
  const lines = [`## ${titles[plan.taskType] || "Workspace answer"}`];
  output.answer.sections.forEach((section) => {
    if (section.items.length === 0) return;
    const sectionName = `${section.type || "Details"}`
      .replace(/_/g, " ")
      .replace(/^./, (value) => value.toUpperCase());
    lines.push("", `### ${escapeMarkdown(sectionName, 80)}`, "");
    section.items.forEach((item) => {
      lines.push(`- ${escapeMarkdown(item.text, 500)}`);
    });
  });
  if (output.recommendations.length > 0) {
    lines.push("", "### Metrics to consider", "");
    output.recommendations.forEach((item) => {
      lines.push(`- ${escapeMarkdown(item.text, 400)}`);
    });
  }
  const complete = outputs.every((item) => item.status === "complete"
    && item.coverage.complete
    && !item.coverage.truncated);
  lines.push("", complete
    ? "Coverage includes all evidence requested by this task."
    : "Some requested evidence was unavailable or limited.");
  if (pendingAction) {
    lines.push("", "Review the prepared change below. It will not be applied until you confirm it.");
  }
  return lines.join("\n").trim();
}

function getManifestContext(facts, activity) {
  const context = { activity };
  Object.entries(SECTION_TYPES).forEach(([factType, section]) => {
    if (["metric_change", "metric_evaluation", "alert", "data_health", "coverage"]
      .includes(factType)) return;
    const count = facts.filter((fact) => fact.factType === factType).length;
    if (count > 0) context[section] = Array.from({ length: count }, () => null);
  });
  return context;
}

function getProjectIds(facts) {
  return facts.map((fact) => {
    const match = `${fact.projectRef || ""}`.match(/^project:(\d+)$/);
    return match ? Number(match[1]) : null;
  }).filter(Boolean);
}

function aggregateUsage(usageRecords) {
  return usageRecords.reduce((total, item) => ({
    completion_tokens: total.completion_tokens + Number(item?.completion_tokens || 0),
    prompt_tokens: total.prompt_tokens + Number(item?.prompt_tokens || 0),
    total_tokens: total.total_tokens + Number(item?.total_tokens || 0),
  }), { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 });
}

async function runSplitWorkspaceRequest({
  access,
  accessEnvelopeReader = getWorkspaceAccessEnvelope,
  activityReader = readWorkspaceActivity,
  availableTools,
  client,
  fallbackRunner = runDeterministicWorkspaceRequest,
  history = [],
  options = {},
  pendingActionClearer = clearPendingActions,
  policy = getWorkspaceOrchestratorPolicy(),
  question,
  toolRunner,
}) {
  const route = routeWorkspaceRequest({ message: question });
  if (route?.mode !== "planner" || !policy.externalWorkspaceContextEnabled || !client) return null;

  const [activity, envelope, toolDefinitions] = await Promise.all([
    activityReader(access),
    accessEnvelopeReader(access),
    availableTools(),
  ]);
  const allowedToolNames = getAllowedSplitToolNames({ envelope, options, policy });
  const definitionsByName = new Map(toolDefinitions
    .filter((definition) => allowedToolNames.has(definition.name))
    .map((definition) => [definition.name, definition]));
  const store = createFactStore({ visibleProjectIds: envelope.visibleProjectIds });
  const bootstrapNormalized = normalizeToolResult(
    "get_workspace_activity",
    activity,
    store,
    { maximumCharacters: policy.maximumContextCharacters }
  );
  const bootstrapFacts = bootstrapNormalized.facts;
  const budget = createProviderBudget(policy);
  const pendingActions = [];
  const roleCalls = { planner: 0, synthesis: 0, worker: 0 };
  const usageRecords = [];
  let externalProviderUsed = false;
  let serverToolCallCount = 1;
  let toolCallCount = 0;

  const buildManifest = (facts, resultStatus) => buildContextManifest({
    characterCount: budget.snapshot().contextCharacters,
    context: getManifestContext(facts, activity),
    externalProviderUsed,
    modelRoleCalls: roleCalls,
    projectIds: getProjectIds(facts),
    purpose: "workspace_orchestration",
    resultStatus,
    serverToolCallCount,
    truncated: Boolean(
      activity.coverage?.truncated
      || facts.some((fact) => fact.factType === "coverage" && fact.state === "partial")
    ),
  });

  const finishFallback = async () => {
    if (options.aiSessionId) {
      await pendingActionClearer({ access, sessionId: options.aiSessionId });
    }
    const fallback = await fallbackRunner({
      access,
      allowPlannerFallback: true,
      history,
      question,
    });
    if (!fallback) return null;
    const manifest = buildManifest(bootstrapFacts, "fallback");
    const externalUsage = usageRecords.map((usage) => ({
      ...usage,
      context_manifest: manifest,
    }));
    return {
      ...fallback,
      contextManifest: manifest,
      usage: aggregateUsage(externalUsage),
      usageRecords: [
        ...externalUsage,
        ...(fallback.usageRecords || []).map((usage) => ({
          ...usage,
          context_manifest: manifest,
        })),
      ],
    };
  };

  try {
    const plannerEnvelope = buildPlannerEnvelope({
      activity,
      capabilities: getCapabilities(envelope, options),
      policy,
      question,
      taskCatalog: getTaskCatalog(allowedToolNames),
      visibleProjectIds: envelope.visibleProjectIds,
    });
    externalProviderUsed = true;
    roleCalls.planner += 1;
    const plannerCall = await callProviderRole({
      budget,
      client,
      envelope: plannerEnvelope,
      maximumOutputTokens: policy.maximumPlannerOutputTokens,
      model: policy.plannerModel,
      reasoningEffort: policy.plannerReasoningEffort,
      role: "planner",
      schema: PLANNER_SCHEMA,
      schemaName: "chartbrew_workspace_plan",
    });
    if (plannerCall.usage) usageRecords.push(plannerCall.usage);
    const plan = validatePlannerPlan(getResponseJson(plannerCall.response), {
      activityBootstrapAvailable: true,
      allowedToolNames: [...allowedToolNames],
      policy,
    });

    const runWorker = async ({ dependencyResults, task }) => {
      const dependencyFactIds = dependencyResults.flatMap((result) => (
        result?.facts?.map((fact) => fact.factId) || []
      ));
      const dependencyFacts = store.getExternalFacts(dependencyFactIds);
      const workerFacts = getExternalFactsForTask({
        bootstrapFacts,
        dependencyFacts,
        task,
      });
      const toolEnvelope = buildWorkerEnvelope({
        ...workerFacts,
        task,
      });
      roleCalls.worker += 1;
      const toolCallResponse = await callProviderRole({
        budget,
        client,
        envelope: toolEnvelope,
        maximumOutputTokens: policy.maximumWorkerOutputTokens,
        model: policy.workerModel,
        reasoningEffort: policy.workerReasoningEffort,
        role: "worker_tools",
        tools: buildWorkerTools(task, definitionsByName),
      });
      if (toolCallResponse.usage) usageRecords.push(toolCallResponse.usage);
      const calls = getResponseToolCalls(toolCallResponse.response);
      if (calls.length < 1 || calls.length > task.maximumToolCalls) {
        const error = new Error("The worker exceeded its tool-call contract");
        error.code = "WORKER_TOOL_CALL_COUNT";
        throw error;
      }
      const normalizedResults = [];
      for (const call of calls) {
        if (!task.allowedTools.includes(call.name)) {
          const error = new Error("The worker requested a forbidden tool");
          error.code = "WORKER_TOOL_FORBIDDEN";
          throw error;
        }
        toolCallCount += 1;
        if (toolCallCount > policy.maximumTotalToolCalls) {
          const error = new Error("The worker exceeded the total tool budget");
          error.code = "WORKER_TOTAL_TOOL_BUDGET";
          throw error;
        }
        const definition = definitionsByName.get(call.name);
        const workerDefinition = getWorkerToolDefinition(definition);
        const args = parseToolArguments(call, workerDefinition);
        assertProjectFilter(args, envelope);
        let normalizedResult;
        if (call.name === "get_workspace_activity"
          && args.project_id === undefined
          && args.from === undefined
          && args.to === undefined) {
          const bounded = boundFacts(bootstrapFacts, task.maximumOutputCharacters);
          normalizedResult = {
            coverage: {
              complete: bootstrapNormalized.coverage.complete && !bounded.truncated,
              missingEvidence: [],
              truncated: bootstrapNormalized.coverage.truncated || bounded.truncated,
            },
            facts: bounded.facts,
            previewPrepared: false,
          };
        } else {
          const payload = buildScopedToolPayload({
            access,
            args,
            options,
            question,
            store,
            task,
            toolName: call.name,
          });
          // oxlint-disable-next-line no-await-in-loop
          const result = await toolRunner(call.name, payload);
          serverToolCallCount += 1;
          const pendingAction = getPendingAction(call.name, result);
          if (pendingAction) pendingActions.push(pendingAction);
          normalizedResult = normalizeToolResult(call.name, result, store, {
            maximumCharacters: task.maximumOutputCharacters,
          });
        }
        normalizedResults.push(normalizedResult);
      }
      const merged = {
        coverage: {
          complete: normalizedResults.every((result) => result.coverage.complete),
          missingEvidence: normalizedResults.flatMap((result) => result.coverage.missingEvidence),
          truncated: normalizedResults.some((result) => result.coverage.truncated),
        },
        facts: normalizedResults.flatMap((result) => result.facts),
        previewPrepared: normalizedResults.some((result) => result.previewPrepared),
      };
      const outputEnvelope = buildWorkerEnvelope({
        dependencyFacts,
        facts: merged.facts,
        task,
      });
      outputEnvelope.serverResult = {
        coverage: merged.coverage,
        factRefs: merged.facts.map((fact) => ({
          evidenceRefs: fact.evidenceRefs,
          factId: fact.factId,
          factType: fact.factType,
          state: fact.state,
        })),
        previewPrepared: merged.previewPrepared,
      };
      const currentPendingIds = pendingActions.map((action) => action.actionId);
      assertNoForbiddenExternalData(outputEnvelope, { pendingActionIds: currentPendingIds });
      roleCalls.worker += 1;
      const outputCall = await callProviderRole({
        budget,
        client,
        envelope: outputEnvelope,
        maximumOutputTokens: policy.maximumWorkerOutputTokens,
        model: policy.workerModel,
        pendingActionIds: currentPendingIds,
        reasoningEffort: policy.workerReasoningEffort,
        role: "worker_output",
        schema: WORKER_SCHEMA,
        schemaName: "chartbrew_workspace_worker",
      });
      if (outputCall.usage) usageRecords.push(outputCall.usage);
      const allowedFacts = new Set([
        ...dependencyFacts.map((fact) => fact.factId),
        ...merged.facts.map((fact) => fact.factId),
      ]);
      return validateWorkerOutput(getResponseJson(outputCall.response), {
        allowedFactIds: allowedFacts,
        factRegistry: store.registry,
        previewPrepared: merged.previewPrepared,
        task,
      });
    };

    const outputs = await dispatchPlan(plan, {
      maximumParallelWorkers: policy.maximumParallelWorkers,
      runWorker,
      validateWorkerResult: (result) => result,
    });
    const visiblePendingAction = pendingActions.length === 1
      && outputs.some((output) => output.previewPrepared)
      ? pendingActions[0]
      : null;
    if (pendingActions.length > 0 && !visiblePendingAction) {
      await pendingActionClearer({ access, sessionId: options.aiSessionId });
      pendingActions.length = 0;
    }
    const accessibleFacts = getAccessibleFacts(outputs, bootstrapFacts, plan, store);
    const synthesisEnvelope = buildSynthesisEnvelope({
      facts: accessibleFacts,
      outputs,
      plan,
    });
    const currentPendingIds = pendingActions.map((action) => action.actionId);
    assertNoForbiddenExternalData(synthesisEnvelope, { pendingActionIds: currentPendingIds });
    roleCalls.synthesis += 1;
    const synthesisCall = await callProviderRole({
      budget,
      client,
      envelope: synthesisEnvelope,
      maximumOutputTokens: policy.maximumSynthesisOutputTokens,
      model: policy.synthesisModel,
      pendingActionIds: currentPendingIds,
      reasoningEffort: policy.synthesisReasoningEffort,
      role: "synthesis",
      schema: SYNTHESIS_SCHEMA,
      schemaName: "chartbrew_workspace_answer",
    });
    if (synthesisCall.usage) usageRecords.push(synthesisCall.usage);
    const accessibleFactIds = accessibleFacts.map((fact) => fact.factId);
    const validated = validateSynthesisOutput(getResponseJson(synthesisCall.response), {
      accessibleFactIds,
      allowedSummaryTextValues: accessibleFacts.flatMap((fact) => (
        store.registry.get(fact.factId)?.allowedTextValues || []
      )),
      factRegistry: store.registry,
    });
    const message = renderSynthesis(validated, visiblePendingAction, plan, outputs);
    const manifest = buildManifest(accessibleFacts, "validated");
    const finalUsageRecords = usageRecords.map((usage) => ({
      ...usage,
      context_manifest: manifest,
    }));
    return {
      contextManifest: manifest,
      conversationHistory: [
        ...history,
        { content: question, role: "user" },
        { content: message, role: "assistant" },
      ],
      iterations: toolCallCount,
      message,
      pendingAction: visiblePendingAction,
      snapshots: [],
      usage: aggregateUsage(finalUsageRecords),
      usageRecords: finalUsageRecords,
    };
  } catch (_error) {
    return finishFallback();
  }
}

module.exports = {
  SPLIT_RUNTIME_TOOLS,
  aggregateUsage,
  assertProjectFilter,
  buildScopedToolPayload,
  buildWorkerTools,
  getAllowedSplitToolNames,
  getCapabilities,
  getPendingAction,
  getTaskCatalog,
  getWorkerToolDefinition,
  parseToolArguments,
  renderSynthesis,
  runSplitWorkspaceRequest,
};
