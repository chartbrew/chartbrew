const DigestController = require("../../../../controllers/DigestController");
const MetricRecommendationController = require("../../../../controllers/MetricRecommendationController");
const MonitorController = require("../../../../controllers/MonitorController");
const { serializeRecommendation } = require("../../../observations/metricRecommendations");
const { buildContextManifest } = require("../../../workspaceContext/contextManifest");
const {
  buildDeterministicAttentionSummary,
  buildDeterministicFreshnessSummary,
  buildDeterministicWorkspaceSummary,
  escapeMarkdown,
} = require("../../../workspaceContext/deterministicSummary");
const {
  CHARTBREW_AI_DISABLED_MESSAGE,
  getWorkspaceOrchestratorPolicy,
} = require("../../../workspaceContext/policy");
const { readWorkspaceActivity } = require("../../../workspaceContext/workspaceActivityProjection");
const {
  getRoleBoundaryMessage,
} = require("../rolePolicy");
const {
  getWorkspaceLearningProjection,
} = require("../../../workspaceContext/workspaceLearningProjection");
const {
  ACTIVITY_INTENTS,
} = require("../../../workspaceContext/workspaceActivityFocus");
const { routeWorkspaceRequest } = require("./deterministicRouter");

function getRecommendationLearningScore(recommendation, signals = []) {
  const metricKey = recommendation._definition?.bindingKey;
  if (!metricKey) return 0;
  return signals.reduce((score, signal) => {
    if (signal.subject?.metricKey !== metricKey) return score;
    const verdict = signal.decision?.verdict;
    if (!["relevant", "not_relevant"].includes(verdict)) return score;
    if (signal.strength === "explicit_feedback") {
      return score + (verdict === "relevant" ? 4 : -4);
    }
    if (signal.strength === "workspace_aggregate") {
      return score + (verdict === "relevant" ? 2 : -2);
    }
    return score;
  }, 0);
}

function rankRecommendationsWithLearning(recommendations = [], signals = []) {
  return recommendations
    .map((recommendation, index) => ({
      index,
      recommendation,
      score: getRecommendationLearningScore(recommendation, signals),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.recommendation);
}

function getActivityLearningScore(item, signals = []) {
  return signals.reduce((score, signal) => {
    const sameMonitor = item.monitorId
      && `${signal.subject?.monitorId || ""}` === `${item.monitorId}`;
    const sameProject = item.project?.id
      && Number(signal.scope?.projectId) === Number(item.project.id);
    if (signal.strength === "explicit_feedback") {
      if (!sameMonitor) return score;
      return score + (signal.decision?.verdict === "relevant" ? 6 : -6);
    }
    if (signal.strength === "explicit_correction") {
      return sameMonitor ? score + 5 : score;
    }
    if (signal.strength === "explicit_decision") {
      return sameMonitor ? score + 4 : score;
    }
    if (signal.strength !== "weak_attention") return score;
    const appliesToItem = sameMonitor
      || (signal.decision?.attention === "pinned" && sameProject);
    if (!appliesToItem) return score;
    if (signal.decision?.attention === "saved" || signal.decision?.attention === "pinned") {
      return score + 1;
    }
    if (["dismissed", "snoozed"].includes(signal.decision?.attention)) return score - 1;
    return score;
  }, 0);
}

function rankActivityItemsWithLearning(items = [], signals = []) {
  return items
    .map((item, index) => ({
      index,
      item,
      score: getActivityLearningScore(item, signals),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ item }) => item);
}

function rankActivityWithLearning(activity, signals = []) {
  return {
    ...activity,
    changes: rankActivityItemsWithLearning(activity.changes, signals),
    evaluations: rankActivityItemsWithLearning(activity.evaluations, signals),
  };
}

function formatWatchReview(monitors) {
  if (monitors.length === 0) return "There are no watched metrics in the dashboards you can access.";
  const lines = ["## Watched metrics", ""];
  monitors.forEach((monitor) => {
    const project = monitor.projectName ? ` in ${escapeMarkdown(monitor.projectName, 100)}` : "";
    const status = monitor.status === "ready" ? "ready" : "collecting data";
    lines.push(`- **${escapeMarkdown(monitor.name, 120)}**${project} — ${status}.`);
  });
  return lines.join("\n");
}

function formatKpiReviews(reviews) {
  if (reviews.length === 0) return "You have no scheduled KPI reviews.";
  const lines = ["## Your KPI reviews", ""];
  reviews.forEach((review) => {
    const scope = escapeMarkdown(review.scope?.name || "All accessible dashboards", 120);
    lines.push(
      `- **${scope}** — ${escapeMarkdown(review.cadence, 30)} at ${escapeMarkdown(review.localDeliveryTime, 20)} (${escapeMarkdown(review.timezone, 80)}).`
    );
  });
  return lines.join("\n");
}

function formatRecommendations(recommendations) {
  if (recommendations.length === 0) {
    return "I did not find a new metric that can be watched from your editable dashboards.";
  }
  const lines = ["## Metrics to consider", ""];
  recommendations.forEach((recommendation) => {
    const source = [recommendation.project?.name, recommendation.chart?.name]
      .filter(Boolean)
      .map((value) => escapeMarkdown(value, 100))
      .join(" · ");
    const reasons = (recommendation.reasons || [])
      .slice(0, 2)
      .map((reason) => escapeMarkdown(reason, 180))
      .join(" ");
    lines.push(`- **${escapeMarkdown(recommendation.name, 120)}**${source ? ` — ${source}.` : "."} ${reasons} This metric is not watched yet.`);
  });
  lines.push("", "Ask me to prepare one if you want to review its settings before it is added.");
  return lines.join("\n");
}

function getProjectIds(context) {
  const values = [
    ...(context.activity?.changes || []),
    ...(context.activity?.evaluations || []),
    ...(context.activity?.health || []),
    ...(context.activity?.alerts || []),
    ...(context.watches || []),
    ...(context.recommendations || []),
  ];
  return values.map((item) => (
    item.project?.id ?? item.projectId ?? item.project_id
  )).filter(Boolean);
}

function buildResult({ context, history, message, purpose, question }) {
  const manifest = buildContextManifest({
    context,
    externalProviderUsed: false,
    modelRoleCalls: {},
    projectIds: getProjectIds(context),
    purpose,
    resultStatus: "deterministic",
    serverToolCallCount: 1,
    truncated: Boolean(context.activity?.coverage?.truncated),
  });
  return {
    contextManifest: manifest,
    conversationHistory: [
      ...history,
      { content: question, role: "user" },
      { content: message, role: "assistant" },
    ],
    iterations: 0,
    message,
    snapshots: [],
    usage: { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 },
    usageRecords: [{
      completion_tokens: 0,
      context_manifest: manifest,
      elapsed_ms: 0,
      model: "deterministic",
      prompt_tokens: 0,
      purpose,
      total_tokens: 0,
    }],
  };
}

function buildActivityMessage(activity, intent) {
  if (intent === "metric_attention") {
    return buildDeterministicAttentionSummary(activity);
  }
  if (intent === "data_freshness") {
    return buildDeterministicFreshnessSummary(activity);
  }
  return buildDeterministicWorkspaceSummary(activity);
}

async function runDeterministicWorkspaceRequest({
  access,
  allowPlannerFallback = false,
  history = [],
  question,
  roleBoundaryOnly = false,
}) {
  const policy = getWorkspaceOrchestratorPolicy();
  if (!policy.enabled) {
    return buildResult({
      context: {},
      history,
      message: CHARTBREW_AI_DISABLED_MESSAGE,
      purpose: "ai_disabled",
      question,
    });
  }
  const boundaryMessage = getRoleBoundaryMessage(access.role, question);
  if (boundaryMessage) {
    return buildResult({
      context: {},
      history,
      message: boundaryMessage,
      purpose: "role_boundary",
      question,
    });
  }
  const route = routeWorkspaceRequest({ message: question });
  if (!route) return null;
  if (ACTIVITY_INTENTS.has(route.intent) && !policy.workspaceSummariesEnabled) {
    return buildResult({
      context: {},
      history,
      message: "Workspace summaries are turned off. A platform administrator can turn them on in Settings.",
      purpose: "workspace_summary_disabled",
      question,
    });
  }
  if (route.intent === "watch_recommendation" && !policy.metricRecommendationsEnabled) {
    return buildResult({
      context: {},
      history,
      message: "Metric watch recommendations are turned off. A platform administrator can turn them on in Settings.",
      purpose: "metric_recommendations_disabled",
      question,
    });
  }
  if (roleBoundaryOnly) return null;

  if (route.mode === "planner" && allowPlannerFallback) {
    const normalized = `${question || ""}`.toLowerCase();
    if (/\b(kpi review|kpi summary|scheduled summary)\b/.test(normalized)) {
      const reviews = (await new DigestController().list(access)).slice(0, 10);
      return buildResult({
        context: { kpiReviews: reviews },
        history,
        message: formatKpiReviews(reviews),
        purpose: "workspace_fallback",
        question,
      });
    }
    if (/\b(watch|watched metric|metric monitor)\b/.test(normalized)) {
      const monitors = (await new MonitorController().list(access)).slice(0, 50);
      return buildResult({
        context: { watches: monitors },
        history,
        message: formatWatchReview(monitors),
        purpose: "workspace_fallback",
        question,
      });
    }
    const activity = await readWorkspaceActivity(access);
    return buildResult({
      context: { activity },
      history,
      message: buildDeterministicWorkspaceSummary(activity),
      purpose: "workspace_fallback",
      question,
    });
  }
  if (route.mode !== "fast_path") return null;

  if (ACTIVITY_INTENTS.has(route.intent)) {
    const storedActivity = await readWorkspaceActivity(access);
    const learning = await getWorkspaceLearningProjection(access, {
      maximumAgeDays: 365,
      task: "summary",
    });
    const activity = rankActivityWithLearning(storedActivity, learning.items);
    return buildResult({
      context: { activity },
      history,
      message: buildActivityMessage(activity, route.intent),
      purpose: route.intent,
      question,
    });
  }
  if (route.intent === "watch_review") {
    const monitors = (await new MonitorController().list(access)).slice(0, 50);
    return buildResult({
      context: { watches: monitors },
      history,
      message: formatWatchReview(monitors),
      purpose: "watch_review",
      question,
    });
  }
  if (route.intent === "kpi_review") {
    const reviews = (await new DigestController().list(access)).slice(0, 10);
    return buildResult({
      context: { kpiReviews: reviews },
      history,
      message: formatKpiReviews(reviews),
      purpose: "kpi_review",
      question,
    });
  }
  if (route.intent === "watch_recommendation") {
    const [candidateRecommendations, learning] = await Promise.all([
      new MetricRecommendationController().generate(access, {
        includeDismissed: false,
        limit: 20,
      }),
      getWorkspaceLearningProjection(access, {
        maximumAgeDays: 365,
        task: "recommendation",
      }),
    ]);
    const recommendations = rankRecommendationsWithLearning(
      candidateRecommendations,
      learning.items
    ).slice(0, 3).map(serializeRecommendation);
    return buildResult({
      context: { recommendations },
      history,
      message: formatRecommendations(recommendations),
      purpose: "watch_recommendation",
      question,
    });
  }
  return null;
}

module.exports = {
  buildActivityMessage,
  formatKpiReviews,
  formatRecommendations,
  formatWatchReview,
  getRecommendationLearningScore,
  rankActivityItemsWithLearning,
  rankActivityWithLearning,
  rankRecommendationsWithLearning,
  runDeterministicWorkspaceRequest,
};
