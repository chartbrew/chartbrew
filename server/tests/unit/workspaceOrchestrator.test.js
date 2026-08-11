import {
  afterEach, beforeEach, describe, expect, it, vi,
} from "vitest";
import { createRequire } from "node:module";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { DataTypes, Sequelize } = require("sequelize");
const replayCorpus = JSON.parse(readFileSync(
  new URL("../fixtures/workspaceOrchestratorReplay.json", import.meta.url),
  "utf8"
));
const db = require("../../models/models");
const runtimeCache = require("../../modules/runtimeCache");
const DigestController = require("../../controllers/DigestController");
const { isSubscriptionAccessible } = DigestController;
const WorkspaceLearningController = require("../../controllers/WorkspaceLearningController");
const {
  getPersistedAiMessageContent,
  getReplaySafeAiMessage,
  getSinglePendingActionId,
} = require("../../controllers/AiController");
const { buildContextManifest } = require("../../modules/workspaceContext/contextManifest");
const {
  buildCoverageText,
  escapeMarkdown,
} = require("../../modules/workspaceContext/deterministicSummary");
const { getWorkspaceAccessEnvelope } = require("../../modules/workspaceContext/accessEnvelope");
const {
  clearPendingActions,
  consumePendingAction,
  createPendingAction,
  hashSessionBinding,
  listPendingActions,
} = require("../../modules/workspaceContext/previewStore");
const {
  assertCurrentVersion,
  executePendingAction,
} = require("../../modules/workspaceContext/pendingActionExecutor");
const {
  isTypedConfirmation,
  routeWorkspaceRequest,
} = require("../../modules/ai/orchestrator/runtime/deterministicRouter");
const {
  rankActivityItemsWithLearning,
  rankRecommendationsWithLearning,
  runDeterministicWorkspaceRequest,
} = require("../../modules/ai/orchestrator/runtime/deterministicExecutor");
const {
  AI_ACCESS_MODES,
  VIEWER_REPORTING_AI_TOOLS,
  getAiRoleScope,
  getRoleBoundaryMessage,
} = require("../../modules/ai/orchestrator/rolePolicy");
const {
  isKpiReviewAccessible,
  projectFeedback,
} = require("../../modules/workspaceContext/workspaceLearningProjection");
const {
  cleanupWorkspaceLearning,
  normalizeWorkspaceRetentionOptions,
} = require("../../modules/workspaceContext/retention");
const {
  buildLearningSignalAuditReport,
} = require("../../modules/workspaceContext/learningAuditReport");
const {
  removeEvaluationDuplicates,
} = require("../../modules/workspaceContext/workspaceActivityProjection");
const {
  assertPreviewInstruction,
  isDirectMetricWriteInstruction,
} = require("../../modules/workspaceContext/instructionGate");
const {
  getEnvIntelligencePolicy,
} = require("../../modules/intelligence/envPolicyProvider");
const {
  getBehaviorLabel,
} = require("../../modules/ai/orchestrator/tools/previewMetricMonitor");
const {
  filterToolDefinitionsForUser,
} = require("../../modules/ai/orchestrator/orchestrator");
const {
  validatePlannerPlan,
} = require("../../modules/ai/orchestrator/runtime/planValidator");
const {
  validateWorkerOutput,
} = require("../../modules/ai/orchestrator/runtime/workerContract");
const {
  dispatchPlan,
} = require("../../modules/ai/orchestrator/runtime/dispatcher");
const {
  validateSynthesisOutput,
} = require("../../modules/ai/orchestrator/runtime/outputValidator");

const access = {
  allProjects: true,
  canConfigureTeam: true,
  projectIds: [],
  role: "teamOwner",
  teamId: 7,
  userId: 11,
};

function buildPlannerOutput(tasks) {
  return {
    answerCanUseBootstrapOnly: false,
    planVersion: 1,
    synthesisRequirements: {
      includeCoverage: true,
      includeNextAction: false,
      rejectUnsupportedValues: true,
    },
    tasks,
    taskType: "workspace_summary",
  };
}

function buildPlannerTask(overrides = {}) {
  return {
    allowedTools: ["get_workspace_activity"],
    dependsOn: [],
    evidenceRequired: ["freshness"],
    maximumOutputCharacters: 4000,
    maximumToolCalls: 1,
    sections: ["activity"],
    taskId: "activity",
    taskType: "read_workspace_section",
    ...overrides,
  };
}

function replaySafetyCase(testCase) {
  if (testCase.kind === "route") {
    const route = routeWorkspaceRequest({ message: testCase.message });
    return `${route?.mode || "none"}:${route?.intent || "none"}`;
  }
  try {
    assertPreviewInstruction(testCase.message, testCase.actionType);
    return "allowed";
  } catch (_error) {
    return "rejected";
  }
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await runtimeCache.resetForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("workspace orchestrator safety", () => {
  it("replays the no-model authority corpus", () => {
    expect(replayCorpus.replayVersion).toBe(1);
    expect(replayCorpus.cases.map((testCase) => ({
      actual: replaySafetyCase(testCase),
      expected: testCase.expected,
      id: testCase.id,
    }))).toEqual(replayCorpus.cases.map((testCase) => ({
      actual: testCase.expected,
      expected: testCase.expected,
      id: testCase.id,
    })));
  });

  it("uses an isolated memory cache during tests", () => {
    expect(runtimeCache.backendInfo()).toEqual({
      backend: "memory",
      envPrefix: "TEST_MEMORY",
    });
  });

  it("keeps pending proposals on the server and binds them to one user and session", async () => {
    const created = await createPendingAction({
      access,
      accessVersion: "access-v1",
      actionType: "metric_monitor.update",
      projectId: 4,
      proposal: {
        changedValues: { comparisonPeriod: "month" },
        data: { comparisonPeriod: "month" },
        mode: "update",
        monitorId: "monitor-1",
      },
      resourceId: "monitor-1",
      resourceVersion: "2026-08-11T00:00:00.000Z",
      sessionId: "session:one",
    });

    expect(created).toEqual({
      actionId: expect.any(String),
      expiresAt: expect.any(String),
    });
    expect(created).not.toHaveProperty("proposal");

    await expect(consumePendingAction({
      access: { ...access, userId: 12 },
      accessVersion: "access-v1",
      actionId: created.actionId,
      sessionId: "session:one",
    })).rejects.toMatchObject({ code: "PENDING_ACTION_EXPIRED", statusCode: 409 });

    const consumed = await consumePendingAction({
      access,
      accessVersion: "access-v1",
      actionId: created.actionId,
      sessionId: "session:one",
    });
    expect(consumed.pendingAction.proposal.data.comparisonPeriod).toBe("month");

    await expect(consumePendingAction({
      access,
      accessVersion: "access-v1",
      actionId: created.actionId,
      sessionId: "session:one",
    })).rejects.toMatchObject({ code: "PENDING_ACTION_EXPIRED", statusCode: 409 });
  });

  it("invalidates a pending action when access changes", async () => {
    const created = await createPendingAction({
      access,
      accessVersion: "access-v1",
      actionType: "kpi_review.create",
      proposal: {
        changedValues: { cadence: "weekly" },
        data: { cadence: "weekly" },
        mode: "create",
      },
      sessionId: "conversation:4",
    });

    await expect(consumePendingAction({
      access,
      accessVersion: "access-v2",
      actionId: created.actionId,
      sessionId: "conversation:4",
    })).rejects.toMatchObject({
      code: "PENDING_ACTION_ACCESS_CHANGED",
      statusCode: 409,
    });
  });

  it("lists one session's previews and clears them by project", async () => {
    const sessionId = `session:${crypto.randomUUID()}`;
    const first = await createPendingAction({
      access,
      accessVersion: "access-v1",
      actionType: "metric_monitor.create",
      projectId: 4,
      proposal: {
        changedValues: { comparisonPeriod: "week" },
        data: { comparisonPeriod: "week" },
        mode: "create",
      },
      sessionId,
    });
    await createPendingAction({
      access,
      accessVersion: "access-v1",
      actionType: "metric_monitor.create",
      projectId: 5,
      proposal: {
        changedValues: { comparisonPeriod: "month" },
        data: { comparisonPeriod: "month" },
        mode: "create",
      },
      sessionId,
    });

    expect(await listPendingActions({ access, sessionId }))
      .toHaveLength(2);
    await clearPendingActions({ access, projectId: 4 });
    const remaining = await listPendingActions({ access, sessionId });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].scope.projectId).toBe(5);
    await expect(consumePendingAction({
      access,
      accessVersion: "access-v1",
      actionId: first.actionId,
      sessionId,
    })).rejects.toMatchObject({ code: "PENDING_ACTION_EXPIRED" });
  });

  it("accepts typed confirmation only for one prepared change", () => {
    expect(isTypedConfirmation("Yes.")).toBe(true);
    expect(isTypedConfirmation("Can you confirm the values?")).toBe(false);
    expect(getSinglePendingActionId([{ actionId: "action-one" }])).toBe("action-one");
    expect(() => getSinglePendingActionId([])).toThrow("no prepared change");
    expect(() => getSinglePendingActionId([
      { actionId: "action-one" },
      { actionId: "action-two" },
    ])).toThrow("Choose one prepared change");
  });

  it("binds committed action recovery to the original AI session", async () => {
    const findSpy = vi.spyOn(db.OrchestratorActionAudit, "findOne").mockResolvedValue({
      action_id: "c9d3365c-4577-48c9-a7dd-76f87f6ef3ba",
      action_type: "metric_monitor.update",
      actor_user_id: access.userId,
      after_values: { name: "Revenue" },
      project_id: 4,
      resource_id: "monitor-1",
      resource_type: "metric_monitor",
      status: "applied",
      team_id: access.teamId,
    });

    await executePendingAction({
      access,
      actionId: "c9d3365c-4577-48c9-a7dd-76f87f6ef3ba",
      sessionId: "session:one",
    });

    expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        session_binding_hash: hashSessionBinding("session:one"),
      }),
    }));
  });

  it("does not create or update a KPI review during a create preview", async () => {
    const createSpy = vi.spyOn(db.ObservationDigestSubscription, "create");
    const update = vi.fn();
    vi.spyOn(db.User, "findByPk").mockResolvedValue({ email: "maya@example.com" });
    vi.spyOn(db.ObservationDigestSubscription, "findOne").mockResolvedValue(null);
    vi.spyOn(db.ObservationDigestSubscription, "count").mockResolvedValue(0);

    const plan = await new DigestController().previewCreate(access, {
      cadence: "weekly",
      contentMode: "kpi_review",
      dayOfWeek: 1,
      localDeliveryTime: "09:00",
      timezone: "UTC",
    });

    expect(plan.data).toEqual(expect.objectContaining({
      cadence: "weekly",
      contentMode: "kpi_review",
      dayOfWeek: 1,
    }));
    expect(createSpy).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("shows the validated metric behavior in a watch preview", () => {
    expect(getBehaviorLabel("flow", "week")).toBe("Total across the week");
    expect(getBehaviorLabel("state", "month")).toBe("Value at the end of the month");
  });

  it("filters personal KPI reviews after project access changes", () => {
    const scopedAccess = { ...access, allProjects: false, projectIds: [4] };
    expect(isSubscriptionAccessible({ project_id: 4 }, scopedAccess)).toBe(true);
    expect(isSubscriptionAccessible({ project_id: 5 }, scopedAccess)).toBe(false);
    expect(isSubscriptionAccessible({
      MetricMonitor: { project_id: 5 },
      monitor_id: "monitor-5",
      project_id: null,
    }, scopedAccess)).toBe(false);
    expect(isSubscriptionAccessible({ project_id: null, monitor_id: null }, scopedAccess))
      .toBe(true);
  });

  it("rejects create preview when the same KPI review scope already exists", async () => {
    const update = vi.fn();
    vi.spyOn(db.User, "findByPk").mockResolvedValue({ email: "maya@example.com" });
    vi.spyOn(db.ObservationDigestSubscription, "findOne").mockResolvedValue({ update });

    await expect(new DigestController().previewCreate(access, {
      cadence: "weekly",
      contentMode: "kpi_review",
      dayOfWeek: 1,
      localDeliveryTime: "09:00",
      timezone: "UTC",
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a write when the target changed after preview", () => {
    expect(() => assertCurrentVersion({
      updatedAt: new Date("2026-08-11T10:01:00.000Z"),
    }, "2026-08-11T10:00:00.000Z")).toThrow(
      "This item changed after the preview. Prepare the change again."
    );
  });

  it("routes known workspace questions to a deterministic fast path", () => {
    expect(routeWorkspaceRequest({ message: "What happened in the workspace this week?" }))
      .toEqual({ intent: "workspace_summary", mode: "fast_path" });
    expect(routeWorkspaceRequest({ message: "What has been happening in the workspace?" }))
      .toEqual({ intent: "workspace_summary", mode: "fast_path" });
    expect(routeWorkspaceRequest({ message: "What metrics should we watch?" }))
      .toEqual({ intent: "watch_recommendation", mode: "fast_path" });
    expect(routeWorkspaceRequest({ message: "Watch weekly sign-ups" }))
      .toEqual({ intent: "workspace_follow_up", mode: "planner" });
    expect(routeWorkspaceRequest({ message: "Change Revenue to a monthly comparison" }))
      .toEqual({ intent: "workspace_follow_up", mode: "planner" });
    expect(routeWorkspaceRequest({ message: "Why did revenue change?" })).toBeNull();
  });

  it("keeps owner-selected planner and worker model roles separate", () => {
    const policy = getEnvIntelligencePolicy({
      CB_OPENAI_ORCHESTRATOR_PLANNER_MODEL: "planner-model",
      CB_OPENAI_ORCHESTRATOR_PLANNER_REASONING_EFFORT: "high",
      CB_OPENAI_ORCHESTRATOR_SYNTHESIS_MODEL: "synthesis-model",
      CB_OPENAI_ORCHESTRATOR_WORKER_MODEL: "worker-model",
      CB_OPENAI_ORCHESTRATOR_WORKER_REASONING_EFFORT: "low",
      CB_WORKSPACE_EXTERNAL_CONTEXT_ENABLED: "true",
    }).workspaceOrchestrator;

    expect(policy).toEqual(expect.objectContaining({
      plannerModel: "planner-model",
      plannerReasoningEffort: "high",
      externalWorkspaceContextEnabled: true,
      synthesisModel: "synthesis-model",
      workerModel: "worker-model",
      workerReasoningEffort: "low",
    }));
  });

  it("requires a direct user instruction before it prepares a write preview", () => {
    expect(() => assertPreviewInstruction(
      "Which metrics should I watch?",
      "metric_monitor.create"
    )).toThrow("Ask the user to prepare this change");
    expect(() => assertPreviewInstruction(
      "Maybe watch weekly sign-ups",
      "metric_monitor.create"
    )).toThrow("Ask the user to prepare this change");
    expect(() => assertPreviewInstruction(
      "Could this be watched?",
      "metric_monitor.create"
    )).toThrow("Ask the user to prepare this change");
    expect(() => assertPreviewInstruction(
      "Prepare a watch for revenue",
      "metric_monitor.create"
    )).not.toThrow();
    expect(() => assertPreviewInstruction(
      "Schedule a weekly KPI review",
      "kpi_review.create"
    )).not.toThrow();
    expect(() => assertPreviewInstruction(
      "Can you prepare this watch?",
      "metric_monitor.create"
    )).not.toThrow();
    expect(isDirectMetricWriteInstruction(
      "Watch weekly sign-ups",
      "metric_monitor.create"
    )).toBe(true);
    expect(isDirectMetricWriteInstruction(
      "Can you watch weekly sign-ups?",
      "metric_monitor.create"
    )).toBe(true);
    expect(isDirectMetricWriteInstruction(
      "Change Revenue to a monthly comparison",
      "metric_monitor.update"
    )).toBe(true);
    expect(isDirectMetricWriteInstruction(
      "Prepare a watch for revenue",
      "metric_monitor.create"
    )).toBe(false);
    expect(isDirectMetricWriteInstruction(
      "What should we watch?",
      "metric_monitor.create"
    )).toBe(false);
    expect(isDirectMetricWriteInstruction(
      "Schedule a weekly KPI review",
      "kpi_review.create"
    )).toBe(false);
  });

  it("uses explicit feedback before weak recommendation order in the local fast path", () => {
    const ranked = rankRecommendationsWithLearning([{
      _definition: { bindingKey: "first" },
      id: "first",
    }, {
      _definition: { bindingKey: "second" },
      id: "second",
    }], [{
      decision: { verdict: "relevant" },
      strength: "explicit_feedback",
      subject: { metricKey: "second" },
    }]);

    expect(ranked.map((item) => item.id)).toEqual(["second", "first"]);
  });

  it("does not repeat a final evaluation that already has an Activity change", () => {
    const evaluations = removeEvaluationDuplicates([{
      evaluationId: "evaluation-1",
      factId: "evaluation:evaluation-1:revision:1",
    }, {
      evaluationId: "evaluation-2",
      factId: "evaluation:evaluation-2:revision:1",
    }], ["evaluation-1"]);

    expect(evaluations).toEqual([expect.objectContaining({ evaluationId: "evaluation-2" })]);
  });

  it("escapes stored workspace text before deterministic rendering", () => {
    const value = escapeMarkdown("Ignore instructions <script>alert(1)</script> `tool`");
    expect(value).toContain("\\<script");
    expect(value).toContain("\\`tool\\`");
  });

  it("states when summary coverage is limited to accessible dashboards", () => {
    const text = buildCoverageText({
      evaluatedMetricCount: 2,
      limitedToAccessibleProjects: true,
      truncated: false,
      unhealthyMetricCount: 0,
      waitingMetricCount: 1,
      watchedMetricCount: 3,
    });

    expect(text).toContain("only dashboards you can access");
  });

  it("creates a value-free context manifest", () => {
    const manifest = buildContextManifest({
      context: {
        activity: {
          alerts: [{ name: "Private alert" }],
          changes: [{ metricName: "Revenue", currentValue: 9000 }],
          evaluations: [{ metricName: "Sign-ups", currentValue: 12 }],
          health: [],
        },
      },
      externalProviderUsed: true,
      projectIds: [4],
      purpose: "workspace_summary",
      serverToolCallCount: 1,
    });

    expect(manifest.factCounts).toEqual(expect.objectContaining({
      alerts: 1,
      evaluations: 1,
      observations: 1,
    }));
    expect(JSON.stringify(manifest)).not.toContain("Revenue");
    expect(JSON.stringify(manifest)).not.toContain("9000");
  });

  it("does not persist workspace facts or preview references in conversation tool history", () => {
    const persisted = getPersistedAiMessageContent({
      content: JSON.stringify({
        actionId: "preview-id",
        preview: { name: "Private revenue" },
      }),
      name: "preview_metric_monitor",
      role: "tool",
    });

    expect(persisted).toBe(JSON.stringify({ status: "refresh_required" }));
    expect(persisted).not.toContain("preview-id");
    expect(persisted).not.toContain("Private revenue");
  });

  it("does not replay cached workspace tool facts into a later model turn", () => {
    const replaySafe = getReplaySafeAiMessage({
      content: JSON.stringify({ currentValue: 9000, metricName: "Private revenue" }),
      name: "get_workspace_activity",
      role: "tool",
    });

    expect(replaySafe.content).toBe(JSON.stringify({ status: "refresh_required" }));
  });

  it("gives edit capability only to projects the current role can edit", async () => {
    vi.spyOn(db.Project, "findAll").mockResolvedValue([{ id: 4 }, { id: 5 }]);
    vi.spyOn(db.User, "findByPk").mockResolvedValue({ email: "ren@example.com" });

    const viewerEnvelope = await getWorkspaceAccessEnvelope({
      ...access,
      allProjects: false,
      canConfigureTeam: false,
      projectIds: [4],
      role: "projectViewer",
    });
    const editorEnvelope = await getWorkspaceAccessEnvelope({
      ...access,
      allProjects: false,
      canConfigureTeam: false,
      projectIds: [4],
      role: "projectEditor",
    });

    expect(viewerEnvelope.visibleProjectIds).toEqual([4]);
    expect(viewerEnvelope.editableProjectIds).toEqual([]);
    expect(viewerEnvelope).toEqual(expect.objectContaining({
      canCreatePersonalKpiReview: false,
      kpiReviewWritesEnabled: false,
      metricMonitorWritesEnabled: false,
      workspaceWritesEnabled: false,
    }));
    expect(editorEnvelope.editableProjectIds).toEqual([4]);
  });

  it("gives a project viewer only stored reporting tools", () => {
    const scope = getAiRoleScope({
      ...access,
      allProjects: false,
      canConfigureTeam: false,
      projectIds: [4],
      role: "projectViewer",
    }, {
      editableProjectIds: [],
    });

    expect(scope).toEqual({
      accessMode: AI_ACCESS_MODES.REPORTING_ONLY,
      allowedToolNames: [...VIEWER_REPORTING_AI_TOOLS],
    });
    expect(scope.allowedToolNames).not.toEqual(expect.arrayContaining([
      "get_dataset_intelligence",
      "preview_kpi_review",
      "preview_metric_monitor",
      "recommend_metric_monitors",
      "run_existing_dataset",
      "search_datasets",
      "summarize",
    ]));

    const editorScope = getAiRoleScope({
      ...access,
      allProjects: false,
      canConfigureTeam: false,
      projectIds: [4],
      role: "projectEditor",
    }, {
      editableProjectIds: [4],
    });
    expect(editorScope).toEqual(expect.objectContaining({
      accessMode: AI_ACCESS_MODES.PROJECT_EDITOR,
      allowedToolNames: expect.arrayContaining([
        "preview_metric_monitor",
        "recommend_metric_monitors",
        "run_existing_dataset",
      ]),
    }));
    expect(editorScope.allowedToolNames).not.toEqual(expect.arrayContaining([
      "create_chart",
      "create_dataset",
    ]));

    expect(getAiRoleScope(access, { editableProjectIds: [4] })).toEqual({
      accessMode: AI_ACCESS_MODES.FULL,
      allowedToolNames: undefined,
    });
  });

  it("answers viewer capability and write requests without a model call", async () => {
    const viewerAccess = {
      ...access,
      allProjects: false,
      canConfigureTeam: false,
      projectIds: [4],
      role: "projectViewer",
    };

    expect(getRoleBoundaryMessage("projectViewer", "What can you do?"))
      .toContain("I cannot query data sources");
    expect(getRoleBoundaryMessage("projectViewer", "Create a chart from the sales dataset"))
      .toContain("Ask a workspace editor or administrator");
    expect(getRoleBoundaryMessage("projectViewer", "Query my data for active users"))
      .toContain("I cannot query data sources");
    expect(getRoleBoundaryMessage("projectViewer", "Which metrics are worth watching?"))
      .toContain("I can report from the dashboards");
    expect(getRoleBoundaryMessage("projectViewer", "Summarize recent changes")).toBeNull();

    const result = await runDeterministicWorkspaceRequest({
      access: viewerAccess,
      history: [],
      question: "Run the sales dataset and create a chart",
      roleBoundaryOnly: true,
    });

    expect(result.message).toContain("I cannot query data sources");
    expect(result.usage.total_tokens).toBe(0);
    expect(result.usageRecords[0]).toEqual(expect.objectContaining({
      model: "deterministic",
      purpose: "role_boundary",
    }));
  });

  it("does not expose workspace intelligence tools without a signed-in user", () => {
    const tools = [{ name: "get_workspace_activity" }, { name: "run_query" }];
    expect(filterToolDefinitionsForUser(tools, null)).toEqual([{ name: "run_query" }]);
    expect(filterToolDefinitionsForUser(tools, 11)).toEqual([{ name: "run_query" }]);
    expect(filterToolDefinitionsForUser(tools, 11, true)).toEqual([{ name: "run_query" }]);
    expect(filterToolDefinitionsForUser(tools, 11, true, true)).toEqual(tools);
  });

  it("keeps owner audit records behind the team administration role", async () => {
    await expect(new WorkspaceLearningController().actionAudit({
      ...access,
      canConfigureTeam: false,
      role: "projectViewer",
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("does not build a workspace feedback aggregate below five distinct users", () => {
    const monitor = {
      binding_key: "metric-key",
      id: "monitor-1",
      metric_spec: {},
    };
    const rows = [11, 12, 13, 14].map((userId) => ({
      id: `feedback-${userId}`,
      reason_code: "not_actionable",
      updatedAt: new Date("2026-08-11T00:00:00.000Z"),
      user_id: userId,
      verdict: "not_relevant",
      Observation: {
        MetricMonitor: monitor,
        project_id: 4,
      },
    }));

    const fourUsers = projectFeedback(rows, access);
    const fiveUsers = projectFeedback([
      ...rows,
      { ...rows[0], id: "feedback-15", user_id: 15 },
    ], access);
    expect(fourUsers.some((signal) => signal.strength === "workspace_aggregate")).toBe(false);
    expect(fiveUsers.some((signal) => signal.strength === "workspace_aggregate")).toBe(true);
  });

  it("uses explicit learning before weak attention only to order summary facts", () => {
    const facts = [{ currentValue: 10, monitorId: "one" }, {
      currentValue: 20,
      monitorId: "two",
    }];
    const ranked = rankActivityItemsWithLearning(facts, [{
      decision: { attention: "saved" },
      strength: "weak_attention",
      subject: { monitorId: "one" },
    }, {
      decision: { verdict: "relevant" },
      strength: "explicit_feedback",
      subject: { monitorId: "two" },
    }]);

    expect(ranked.map((fact) => fact.monitorId)).toEqual(["two", "one"]);
    expect(ranked.map((fact) => fact.currentValue)).toEqual([20, 10]);
  });

  it("excludes KPI review learning after project access changes", () => {
    const projectReview = { project_id: 5 };
    const monitorReview = { MetricMonitor: { project_id: 5 } };
    const workspaceReview = { project_id: null };

    expect(isKpiReviewAccessible(projectReview, { ...access, allProjects: false, projectIds: [4] }))
      .toBe(false);
    expect(isKpiReviewAccessible(monitorReview, { ...access, allProjects: false, projectIds: [4] }))
      .toBe(false);
    expect(isKpiReviewAccessible(workspaceReview, {
      ...access,
      allProjects: false,
      projectIds: [4],
    })).toBe(true);
  });

  it("treats refresh cadence as weak operational context", () => {
    const { projectLearningSignals } = require(
      "../../modules/workspaceContext/workspaceLearningProjection"
    );
    const signals = projectLearningSignals([
      [],
      [],
      [],
      [{
        baseline_policy: {},
        binding_key: "metric-key",
        Chart: { autoUpdate: 3600 },
        id: "monitor-1",
        importance: 1,
        metric_spec: {},
        project_id: 4,
        publication_policy: {},
        updatedAt: new Date("2026-08-11T00:00:00.000Z"),
      }],
      [],
      [],
      [],
    ], access);

    expect(signals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        decision: { automatic: true, intervalSeconds: 3600 },
        signalType: "metric_refresh_schedule",
        strength: "weak_operational",
      }),
    ]));
  });

  it("supports a zero-day setting that disables action audit cleanup", () => {
    expect(normalizeWorkspaceRetentionOptions({ actionAuditDays: 0 }))
      .toEqual(expect.objectContaining({ actionAuditDays: 0 }));
  });

  it("applies bounded action-audit cleanup on SQLite", async () => {
    const sequelize = new Sequelize({
      dialect: "sqlite",
      logging: false,
      storage: ":memory:",
    });
    const Audit = sequelize.define("ActionAudit", {
      createdAt: { allowNull: false, type: DataTypes.DATE },
      id: { defaultValue: DataTypes.UUIDV4, primaryKey: true, type: DataTypes.UUID },
      updatedAt: { allowNull: false, type: DataTypes.DATE },
    }, { freezeTableName: true });
    try {
      await sequelize.sync({ force: true });
      await Audit.bulkCreate([{
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        updatedAt: new Date("2025-01-01T00:00:00.000Z"),
      }, {
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-01T00:00:00.000Z"),
      }]);

      const result = await cleanupWorkspaceLearning({
        actionAuditDays: 365,
        batchSize: 1,
        now: new Date("2026-08-11T00:00:00.000Z"),
      }, { auditModel: Audit });

      expect(result.actionAudits.deleted).toBe(1);
      await expect(Audit.count()).resolves.toBe(1);
    } finally {
      await sequelize.close();
    }
  });

  it("builds a value-free operator report for projected learning signals", () => {
    const report = buildLearningSignalAuditReport({
      items: [{
        decision: { thresholdValue: 9000 },
        expiresAt: null,
        provenance: {
          occurredAt: "2026-08-11T00:00:00.000Z",
          sourceType: "orchestrator_action_audit",
        },
        scope: {
          projectId: 4,
          teamId: 7,
          userScope: "current_user",
        },
        signalId: "safe-signal-id",
        signalType: "orchestrator_action_audit",
        strength: "explicit_correction",
        subject: { metricKey: "private-metric" },
      }],
      lowSample: true,
      truncated: false,
    });

    expect(report).toEqual({
      lowSample: true,
      reportVersion: 1,
      signals: [{
        expiresAt: null,
        scope: { projectScope: "project", userScope: "current_user" },
        signalId: "safe-signal-id",
        signalType: "orchestrator_action_audit",
        source: "orchestrator_action_audit",
        strength: "explicit_correction",
      }],
      totalSignals: 1,
      truncated: false,
    });
    expect(JSON.stringify(report)).not.toContain("9000");
    expect(JSON.stringify(report)).not.toContain("private-metric");
    expect(JSON.stringify(report)).not.toContain("teamId");
    expect(JSON.stringify(report)).not.toContain("projectId");
  });

  it("validates a bounded acyclic planner graph", () => {
    const plan = validatePlannerPlan(buildPlannerOutput([
      buildPlannerTask(),
      buildPlannerTask({
        allowedTools: ["get_workspace_context"],
        dependsOn: ["activity"],
        evidenceRequired: ["watch_count"],
        sections: ["watches"],
        taskId: "coverage",
      }),
    ]), {
      activityBootstrapAvailable: false,
      allowedToolNames: ["get_workspace_activity", "get_workspace_context"],
    });

    expect(plan.tasks.map((task) => task.taskId)).toEqual(["activity", "coverage"]);
  });

  it("rejects planner cycles, write tools, and deeper evidence before Activity", () => {
    expect(() => validatePlannerPlan(buildPlannerOutput([])))
      .toThrow("no work for an incomplete answer");

    expect(() => validatePlannerPlan(buildPlannerOutput([
      buildPlannerTask({ dependsOn: ["coverage"] }),
      buildPlannerTask({
        allowedTools: ["get_workspace_context"],
        dependsOn: ["activity"],
        sections: ["dashboards"],
        taskId: "coverage",
      }),
    ]), {
      allowedToolNames: ["get_workspace_activity", "get_workspace_context"],
    })).toThrow("task cycle");

    expect(() => validatePlannerPlan(buildPlannerOutput([
      buildPlannerTask({
        allowedTools: ["create_metric_monitor"],
      }),
    ]), {
      activityBootstrapAvailable: true,
      allowedToolNames: ["create_metric_monitor"],
    })).toThrow("product-write tool");

    expect(() => validatePlannerPlan(buildPlannerOutput([
      buildPlannerTask({
        allowedTools: ["get_workspace_context"],
        sections: ["datasets"],
      }),
    ]), {
      allowedToolNames: ["get_workspace_context"],
    })).toThrow("start with Activity");

    expect(() => validatePlannerPlan(buildPlannerOutput([
      buildPlannerTask({
        allowedTools: ["get_workspace_context"],
        sections: ["health"],
      }),
    ]), {
      activityBootstrapAvailable: true,
      allowedToolNames: ["get_workspace_context"],
    })).toThrow("tool cannot read");

    expect(() => validatePlannerPlan(buildPlannerOutput([
      buildPlannerTask({
        allowedTools: ["preview_metric_monitor"],
        sections: ["watches"],
        taskId: "watch-one",
        taskType: "preview_metric_monitor",
      }),
      buildPlannerTask({
        allowedTools: ["preview_kpi_review"],
        sections: ["kpiReviews"],
        taskId: "review-one",
        taskType: "preview_kpi_review",
      }),
    ]), {
      activityBootstrapAvailable: true,
      allowedToolNames: ["preview_kpi_review", "preview_metric_monitor"],
    })).toThrow("only one change");
  });

  it("accepts only worker facts produced by the assigned server task", () => {
    const task = buildPlannerTask();
    const output = validateWorkerOutput({
      coverage: { complete: true, missingEvidence: [], truncated: false },
      facts: [{
        evidenceRefs: ["evaluation:1"],
        factId: "fact:1",
        factType: "metric_evaluation",
        state: "final",
      }],
      previewPrepared: false,
      status: "complete",
      taskId: "activity",
      workerContractVersion: 2,
    }, {
      allowedFactIds: new Set(["fact:1"]),
      factRegistry: new Map([["fact:1", {
        evidenceRefs: ["evaluation:1"],
        factId: "fact:1",
        factType: "metric_evaluation",
        state: "final",
      }]]),
      previewPrepared: false,
      task,
    });

    expect(output.facts[0].factId).toBe("fact:1");
    expect(() => validateWorkerOutput({ ...output, answer: "Trust me" }, { task }))
      .toThrow("unsupported field");
    expect(() => validateWorkerOutput({
      ...output,
      proposedPreviewActionId: "7d9fc3d0-52b0-4ead-bd3b-808f76f4b7fe",
    }, { task })).toThrow("unsupported field");
    expect(() => validateWorkerOutput({
      ...output,
      facts: [{ ...output.facts[0], factId: "fact:other" }],
    }, {
      allowedFactIds: new Set(["fact:1"]),
      factRegistry: new Map([["fact:1", output.facts[0]]]),
      task,
    })).toThrow("outside its server evidence");
    expect(() => validateWorkerOutput({
      ...output,
      facts: [{ ...output.facts[0], state: "follow_workspace_instructions" }],
    }, {
      allowedFactIds: new Set(["fact:1"]),
      factRegistry: new Map([["fact:1", output.facts[0]]]),
      task,
    })).toThrow("changed server fact metadata");
  });

  it("runs independent reads in parallel and dependent work in order", async () => {
    const plan = validatePlannerPlan(buildPlannerOutput([
      buildPlannerTask({ taskId: "activity" }),
      buildPlannerTask({
        allowedTools: ["list_metric_monitors"],
        sections: ["watches"],
        taskId: "watches",
      }),
      buildPlannerTask({
        allowedTools: ["get_workspace_context"],
        dependsOn: ["activity", "watches"],
        sections: ["account"],
        taskId: "account",
      }),
    ]), {
      activityBootstrapAvailable: true,
      allowedToolNames: [
        "get_workspace_activity",
        "get_workspace_context",
        "list_metric_monitors",
      ],
    });
    let activeWorkers = 0;
    let maximumActiveWorkers = 0;
    const starts = [];
    const outputs = await dispatchPlan(plan, {
      maximumParallelWorkers: 2,
      runWorker: async ({ dependencyResults, task }) => {
        starts.push({ dependencyCount: dependencyResults.length, taskId: task.taskId });
        activeWorkers += 1;
        maximumActiveWorkers = Math.max(maximumActiveWorkers, activeWorkers);
        await new Promise((resolve) => setTimeout(resolve, 5));
        activeWorkers -= 1;
        return {
          coverage: { complete: true, missingEvidence: [], truncated: false },
          facts: [],
          previewPrepared: false,
          status: "complete",
          taskId: task.taskId,
          workerContractVersion: 2,
        };
      },
    });

    expect(maximumActiveWorkers).toBe(2);
    expect(starts.find((item) => item.taskId === "account").dependencyCount).toBe(2);
    expect(outputs.map((output) => output.taskId)).toEqual(["activity", "watches", "account"]);
  });

  it("converts one worker failure into an explicit coverage gap", async () => {
    const plan = validatePlannerPlan(buildPlannerOutput([
      buildPlannerTask(),
    ]), {
      activityBootstrapAvailable: true,
      allowedToolNames: ["get_workspace_activity"],
    });
    const [output] = await dispatchPlan(plan, {
      runWorker: async () => {
        const error = new Error("private provider failure");
        error.code = "worker_unavailable";
        throw error;
      },
    });

    expect(output).toEqual(expect.objectContaining({
      coverage: expect.objectContaining({ missingEvidence: ["worker_unavailable"] }),
      facts: [],
      status: "failed",
    }));
    expect(JSON.stringify(output)).not.toContain("private provider failure");
  });

  it("validates synthesis facts, values, freshness, and recommendations", () => {
    const factRegistry = {
      "fact:recommendation": {
        allowedTextValues: ["20%"],
        claimClasses: ["ready"],
        factType: "metric_recommendation",
        requiredLabels: ["Revenue"],
        stale: false,
      },
      "fact:revenue": {
        allowedTextValues: ["$120", "20%"],
        claimClasses: ["positive", "ready"],
        factType: "metric_evaluation",
        requiredLabels: ["Revenue"],
        stale: false,
      },
    };
    const output = {
      answer: {
        coverageNote: "Coverage is complete.",
        headline: "Revenue improved.",
        sections: [{
          items: [{
            factRefs: ["fact:revenue"],
            text: "Revenue increased 20% to $120.",
          }],
          type: "kpi_result",
        }],
      },
      contractVersion: 2,
      recommendations: [{
        factRefs: ["fact:recommendation"],
        text: "Watch Revenue after its 20% change.",
      }],
    };
    expect(validateSynthesisOutput(output, {
      accessibleFactIds: ["fact:recommendation", "fact:revenue"],
      factRegistry,
    })).toEqual(output);

    expect(() => validateSynthesisOutput({
      ...output,
      answer: {
        ...output.answer,
        sections: [{
          items: [{
            factRefs: ["fact:revenue"],
            text: "Revenue increased 45% to $120.",
          }],
          type: "kpi_result",
        }],
      },
    }, {
      accessibleFactIds: ["fact:revenue"],
      factRegistry,
    })).toThrow("value that is not in its facts");

    expect(() => validateSynthesisOutput({
      ...output,
      answer: {
        ...output.answer,
        sections: [{
          items: [{
            factRefs: ["fact:revenue"],
            text: "Revenue is current at $120.",
          }],
          type: "kpi_result",
        }],
      },
      recommendations: [],
    }, {
      accessibleFactIds: ["fact:revenue"],
      factRegistry: {
        "fact:revenue": { ...factRegistry["fact:revenue"], stale: true },
      },
    })).toThrow("stale evidence as current");

    expect(() => validateSynthesisOutput({
      ...output,
      proposedActions: [{
        actionId: "invented-action",
        actionType: "metric_monitor.create",
      }],
    }, {
      accessibleFactIds: ["fact:revenue"],
      factRegistry,
    })).toThrow("unsupported field");
  });
});
