const { getWorkspaceOrchestratorPolicy } = require("../../../workspaceContext/policy");

const READ_TOOLS = new Set([
  "get_workspace_activity",
  "get_workspace_context",
  "list_kpi_reviews",
  "list_metric_monitors",
  "recommend_metric_monitors",
]);
const PREVIEW_TOOLS = new Set([
  "preview_kpi_review",
  "preview_metric_monitor",
]);
const FORBIDDEN_WRITE_TOOLS = new Set([
  "create_kpi_review",
  "create_metric_monitor",
  "update_kpi_review",
  "update_metric_monitor",
]);
const KNOWN_TASK_TYPES = new Set([
  "preview_kpi_review",
  "preview_metric_monitor",
  "read_workspace_section",
  "recommend_metric_monitors",
]);
const KNOWN_PLAN_TASK_TYPES = new Set([
  "kpi_review_preview",
  "watch_preview",
  "watch_recommendation",
  "workspace_question",
  "workspace_summary",
]);
const ALLOWED_SECTIONS = new Set([
  "account",
  "activity",
  "alerts",
  "dashboards",
  "datasets",
  "health",
  "kpiReviews",
  "learning",
  "watches",
]);
const TASK_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const TOOL_SECTIONS = new Map([
  ["get_workspace_activity", new Set(["activity", "alerts", "health"])],
  ["get_workspace_context", new Set([
    "account",
    "dashboards",
    "datasets",
    "kpiReviews",
    "learning",
    "watches",
  ])],
  ["list_kpi_reviews", new Set(["kpiReviews"])],
  ["list_metric_monitors", new Set(["watches"])],
  ["preview_kpi_review", new Set(["account", "kpiReviews"])],
  ["preview_metric_monitor", new Set(["watches"])],
  ["recommend_metric_monitors", new Set(["watches"])],
]);

function createPlanError(message, code) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function assertObjectKeys(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createPlanError(`${label} must be an object`, "PLAN_SCHEMA_INVALID");
  }
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown) {
    throw createPlanError(`${label} contains an unsupported field`, "PLAN_SCHEMA_INVALID");
  }
}

function getStringArray(value, label, maximum = 20) {
  if (!Array.isArray(value) || value.length > maximum
    || value.some((item) => typeof item !== "string" || !item)) {
    throw createPlanError(`${label} must be a bounded string list`, "PLAN_SCHEMA_INVALID");
  }
  return [...new Set(value)];
}

function assertAcyclic(tasks) {
  const dependencies = new Map(tasks.map((task) => [task.taskId, task.dependsOn]));
  const visiting = new Set();
  const visited = new Set();
  const visit = (taskId) => {
    if (visiting.has(taskId)) {
      throw createPlanError("The planner returned a task cycle", "PLAN_CYCLE");
    }
    if (visited.has(taskId)) return;
    visiting.add(taskId);
    dependencies.get(taskId).forEach(visit);
    visiting.delete(taskId);
    visited.add(taskId);
  };
  tasks.forEach((task) => visit(task.taskId));
}

function getTaskToolPolicy(taskType) {
  if (taskType === "read_workspace_section") return READ_TOOLS;
  if (taskType === "recommend_metric_monitors") return new Set(["recommend_metric_monitors"]);
  if (taskType === "preview_metric_monitor") return new Set(["preview_metric_monitor"]);
  if (taskType === "preview_kpi_review") return new Set(["preview_kpi_review"]);
  return new Set();
}

function normalizeTask(task, options) {
  assertObjectKeys(task, new Set([
    "allowedTools",
    "dependsOn",
    "evidenceRequired",
    "maximumOutputCharacters",
    "maximumToolCalls",
    "questionFragment",
    "sections",
    "targetRef",
    "taskId",
    "taskType",
  ]), "Planner task");
  if (!TASK_ID_PATTERN.test(task.taskId || "")) {
    throw createPlanError("The planner returned an invalid task ID", "PLAN_TASK_ID_INVALID");
  }
  if (!KNOWN_TASK_TYPES.has(task.taskType)) {
    throw createPlanError("The planner returned an unknown task type", "PLAN_TASK_TYPE_INVALID");
  }
  const dependsOn = getStringArray(task.dependsOn, "Task dependencies", 10);
  const allowedTools = getStringArray(task.allowedTools, "Task tools", 4);
  if (allowedTools.length !== 1) {
    throw createPlanError("Each worker needs exactly one allowed tool", "PLAN_TOOL_REQUIRED");
  }
  const taskToolPolicy = getTaskToolPolicy(task.taskType);
  allowedTools.forEach((tool) => {
    if (FORBIDDEN_WRITE_TOOLS.has(tool)) {
      throw createPlanError("A worker cannot receive a product-write tool", "PLAN_WRITE_TOOL_FORBIDDEN");
    }
    if (!taskToolPolicy.has(tool) || !options.allowedToolNames.has(tool)) {
      throw createPlanError("The planner requested an unauthorized tool", "PLAN_TOOL_FORBIDDEN");
    }
  });
  const sections = getStringArray(task.sections || [], "Task sections", 8);
  if (sections.some((section) => !ALLOWED_SECTIONS.has(section))) {
    throw createPlanError("The planner requested an unknown context section", "PLAN_SECTION_INVALID");
  }
  const allowedSections = TOOL_SECTIONS.get(allowedTools[0]) || new Set();
  if (sections.some((section) => !allowedSections.has(section))) {
    throw createPlanError(
      "The planner requested a section that its tool cannot read",
      "PLAN_SECTION_TOOL_MISMATCH"
    );
  }
  const maximumToolCalls = Number(task.maximumToolCalls);
  if (!Number.isInteger(maximumToolCalls) || maximumToolCalls < 1
    || maximumToolCalls > options.policy.maximumToolCallsPerWorker
    || maximumToolCalls < allowedTools.length) {
    throw createPlanError("The planner exceeded the worker tool budget", "PLAN_TOOL_BUDGET_EXCEEDED");
  }
  const maximumOutputCharacters = Number(task.maximumOutputCharacters);
  if (!Number.isInteger(maximumOutputCharacters) || maximumOutputCharacters < 100
    || maximumOutputCharacters > Math.min(options.policy.maximumContextCharacters, 12000)) {
    throw createPlanError("The planner exceeded the worker output budget", "PLAN_OUTPUT_BUDGET_EXCEEDED");
  }
  if (task.questionFragment !== undefined
    && (typeof task.questionFragment !== "string" || task.questionFragment.length > 500)) {
    throw createPlanError("The worker question fragment is not valid", "PLAN_SCHEMA_INVALID");
  }
  if (task.targetRef !== undefined
    && (typeof task.targetRef !== "string" || task.targetRef.length > 200)) {
    throw createPlanError("The preview target is not valid", "PLAN_SCHEMA_INVALID");
  }
  return {
    allowedTools,
    dependsOn,
    evidenceRequired: getStringArray(task.evidenceRequired || [], "Evidence requirements", 12),
    maximumOutputCharacters,
    maximumToolCalls,
    questionFragment: task.questionFragment || "",
    sections,
    targetRef: task.targetRef || null,
    taskId: task.taskId,
    taskType: task.taskType,
  };
}

function assertActivityFirst(plan, options) {
  if (plan.taskType !== "workspace_summary" || options.activityBootstrapAvailable) return;
  const activityTasks = new Set(plan.tasks
    .filter((task) => task.allowedTools.includes("get_workspace_activity"))
    .map((task) => task.taskId));
  if (activityTasks.size === 0) {
    throw createPlanError("Workspace planning must start with Activity", "PLAN_ACTIVITY_REQUIRED");
  }
  plan.tasks.forEach((task) => {
    const usesDeeperEvidence = task.sections.some((section) => (
      ["dashboards", "datasets"].includes(section)
    ));
    if (usesDeeperEvidence
      && !task.dependsOn.some((dependency) => activityTasks.has(dependency))) {
      throw createPlanError(
        "Dashboard or dataset evidence must follow Activity",
        "PLAN_ACTIVITY_ORDER_INVALID"
      );
    }
  });
}

function validatePlannerPlan(rawPlan, rawOptions = {}) {
  const policy = rawOptions.policy || getWorkspaceOrchestratorPolicy();
  const allowedToolNames = new Set(rawOptions.allowedToolNames || [
    ...READ_TOOLS,
    ...PREVIEW_TOOLS,
  ]);
  assertObjectKeys(rawPlan, new Set([
    "answerCanUseBootstrapOnly",
    "planVersion",
    "synthesisRequirements",
    "tasks",
    "taskType",
  ]), "Planner output");
  if (rawPlan.planVersion !== 1 || !KNOWN_PLAN_TASK_TYPES.has(rawPlan.taskType)) {
    throw createPlanError("The planner output version or task type is not supported", "PLAN_SCHEMA_INVALID");
  }
  if (typeof rawPlan.answerCanUseBootstrapOnly !== "boolean") {
    throw createPlanError("The planner must state whether bootstrap facts are sufficient", "PLAN_SCHEMA_INVALID");
  }
  if (!Array.isArray(rawPlan.tasks)
    || rawPlan.tasks.length > policy.maximumWorkersPerRequest) {
    throw createPlanError("The planner exceeded the worker budget", "PLAN_WORKER_BUDGET_EXCEEDED");
  }
  const options = {
    activityBootstrapAvailable: Boolean(rawOptions.activityBootstrapAvailable),
    allowedToolNames,
    policy,
  };
  const tasks = rawPlan.tasks.map((task) => normalizeTask(task, options));
  if (!rawPlan.answerCanUseBootstrapOnly && tasks.length === 0) {
    throw createPlanError("The planner returned no work for an incomplete answer", "PLAN_TASK_REQUIRED");
  }
  const taskIds = new Set(tasks.map((task) => task.taskId));
  if (taskIds.size !== tasks.length) {
    throw createPlanError("Planner task IDs must be unique", "PLAN_TASK_ID_DUPLICATE");
  }
  tasks.forEach((task) => {
    if (task.dependsOn.includes(task.taskId)
      || task.dependsOn.some((dependency) => !taskIds.has(dependency))) {
      throw createPlanError("A task dependency is not valid", "PLAN_DEPENDENCY_INVALID");
    }
  });
  assertAcyclic(tasks);
  const totalToolCalls = tasks.reduce((sum, task) => sum + task.maximumToolCalls, 0);
  if (totalToolCalls > policy.maximumTotalToolCalls) {
    throw createPlanError("The planner exceeded the total tool budget", "PLAN_TOOL_BUDGET_EXCEEDED");
  }
  const totalOutputCharacters = tasks.reduce(
    (sum, task) => sum + task.maximumOutputCharacters,
    0
  );
  if (totalOutputCharacters > policy.maximumContextCharacters) {
    throw createPlanError("The planner exceeded the total context budget", "PLAN_OUTPUT_BUDGET_EXCEEDED");
  }
  const previewTargets = tasks
    .filter((task) => PREVIEW_TOOLS.has(task.allowedTools[0]) && task.targetRef)
    .map((task) => `${task.allowedTools[0]}:${task.targetRef}`);
  if (new Set(previewTargets).size !== previewTargets.length) {
    throw createPlanError("The planner repeated a preview target", "PLAN_PREVIEW_DUPLICATE");
  }
  if (tasks.filter((task) => task.allowedTools.some((tool) => PREVIEW_TOOLS.has(tool))).length > 1) {
    throw createPlanError("A request can prepare only one change", "PLAN_PREVIEW_LIMIT");
  }
  assertObjectKeys(rawPlan.synthesisRequirements, new Set([
    "includeCoverage",
    "includeNextAction",
    "rejectUnsupportedValues",
  ]), "Synthesis requirements");
  const synthesisRequirements = {
    includeCoverage: Boolean(rawPlan.synthesisRequirements.includeCoverage),
    includeNextAction: Boolean(rawPlan.synthesisRequirements.includeNextAction),
    rejectUnsupportedValues: rawPlan.synthesisRequirements.rejectUnsupportedValues === true,
  };
  if (!synthesisRequirements.rejectUnsupportedValues) {
    throw createPlanError("Synthesis must reject unsupported values", "PLAN_SYNTHESIS_UNSAFE");
  }
  const plan = {
    answerCanUseBootstrapOnly: rawPlan.answerCanUseBootstrapOnly,
    planVersion: 1,
    synthesisRequirements,
    tasks,
    taskType: rawPlan.taskType,
  };
  assertActivityFirst(plan, options);
  return plan;
}

module.exports = {
  ALLOWED_SECTIONS,
  FORBIDDEN_WRITE_TOOLS,
  KNOWN_TASK_TYPES,
  PREVIEW_TOOLS,
  READ_TOOLS,
  TOOL_SECTIONS,
  assertAcyclic,
  createPlanError,
  validatePlannerPlan,
};
