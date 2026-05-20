# Jira AI Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Jira AI source-owned planning resolve vague Jira context automatically, expose richer Jira capabilities to the orchestrator, and produce useful previews/fallbacks without requiring board IDs or sprint IDs from users.

**Architecture:** Add a focused Jira AI resolver module used by `jira.ai.js` and explicit source tools. Expand Jira resource metadata to mirror the Stripe Official semantic capability style, then update planner output to include `resolution`, `actions`, and `fallback` states. Keep all runtime execution source-owned through Jira `DataRequest.configuration`; `generate_query` and `run_query` remain out of the Jira path.

**Tech Stack:** Node.js, Express source plugin registry, Vitest, Jira Cloud REST/Agile API wrappers, Chartbrew source-owned AI orchestrator tools.

---

## File Map

- Create `server/sources/plugins/jira/ai/jira.resolver.js`: parse Jira hints, run Jira discovery calls, score candidates, and return a compact resolution object.
- Modify `server/sources/plugins/jira/ai/jira.ai.js`: use resolver output in `planDataset`, expose richer capabilities/resources, add semantic intents, actions, fallback planning, and source-owned context resolution exports.
- Modify `server/sources/plugins/jira/jira.resources.js`: add Jira semantic metadata for metrics, dimensions, filters, date fields, transforms, and auto-resolve requirements.
- Modify `server/modules/ai/orchestrator/tools/sourceTools.js`: pass `mode` into source planning and add a generic `source_resolve_context` tool that routes to source AI modules that export `resolveContext`.
- Modify `server/modules/ai/orchestrator/orchestrator.js`: advertise `source_resolve_context`, route it through `callTool`, inject team/original question context, and document Jira source-owned behavior.
- Modify `server/tests/unit/jiraAi.test.js`: cover resolver behavior, planner output, fallbacks, and follow-up context reuse.
- Modify `server/tests/unit/sourceAiHarness.test.js`: cover generic source context resolution, fallback plan contract, compact output, and no secret leakage.
- Modify `server/tests/unit/orchestratorResponsesApi.test.js`: cover the new tool definition and continued Jira/run_query guard.

Git note: Raz handles git manually. Do not run `git add`, `git commit`, or branch commands during execution.

---

### Task 1: Expand Jira Semantic Resource Metadata

**Files:**
- Modify: `server/sources/plugins/jira/jira.resources.js`
- Modify: `server/sources/plugins/jira/ai/jira.ai.js`
- Test: `server/tests/unit/jiraAi.test.js`

- [ ] **Step 1: Add failing metadata assertions**

Add this test to `server/tests/unit/jiraAi.test.js` inside `describe("Jira AI planner", () => { ... })`:

```js
it("exposes Jira semantic capabilities and resource planning metadata", () => {
  const capabilities = jiraAi.getCapabilities();
  const resources = jiraAi.listResources();
  const sprintIssues = resources.resources.find((resource) => resource.id === "sprint_issues");
  const issues = resources.resources.find((resource) => resource.id === "issues");

  expect(capabilities.supports.discovery).toEqual(expect.arrayContaining([
    "projects",
    "boards",
    "sprints",
    "versions",
    "users",
    "fields",
  ]));
  expect(capabilities.supports.semanticIntents).toEqual(expect.arrayContaining([
    "sprint_status",
    "sprint_summary",
    "bug_breakdown",
    "release_progress",
  ]));
  expect(capabilities.supports.riskPolicy).toMatchObject({
    preview: "best_match",
    persist: "disambiguate_meaningful_uncertainty",
  });
  expect(sprintIssues).toMatchObject({
    id: "sprint_issues",
    requires: ["sprint"],
    canAutoResolve: ["project", "board", "activeSprint"],
    metrics: expect.arrayContaining(["count", "storyPoints", "completionRate"]),
    dimensions: expect.arrayContaining(["status", "statusCategory", "assignee", "priority", "issueType"]),
    transforms: expect.arrayContaining(["raw", "grouped", "sprint_summary", "stale_table"]),
    dateFields: expect.arrayContaining(["createdAt", "updatedAt", "resolvedAt", "doneAt"]),
  });
  expect(issues.filters).toEqual(expect.arrayContaining([
    expect.objectContaining({ field: "statusCategory" }),
    expect.objectContaining({ field: "assignee" }),
    expect.objectContaining({ field: "fixVersion" }),
  ]));
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm run test:run -- tests/unit/jiraAi.test.js
```

Expected: failure because `discovery`, `semanticIntents`, `riskPolicy`, `metrics`, `dimensions`, `filters`, `requires`, and `canAutoResolve` are not fully present.

- [ ] **Step 3: Add semantic metadata to Jira resources**

Update `server/sources/plugins/jira/jira.resources.js` by adding constants below `FIELD_MAPPING_NAMES`:

```js
const ISSUE_METRICS = ["count", "storyPoints", "averageLeadTime", "averageCycleTime"];
const SPRINT_METRICS = ["count", "storyPoints", "completionRate", "completedStoryPoints"];
const ISSUE_DIMENSIONS = [
  "date",
  "status",
  "statusCategory",
  "assignee",
  "priority",
  "issueType",
  "project",
  "fixVersion",
  "epic",
  "label",
];
const SPRINT_DIMENSIONS = [
  "status",
  "statusCategory",
  "assignee",
  "priority",
  "issueType",
];
const ISSUE_DATE_FIELDS = ["createdAt", "updatedAt", "resolvedAt", "doneAt"];
const ISSUE_FILTERS = [
  { field: "project", operators: ["in", "is"] },
  { field: "issueType", operators: ["in", "is"] },
  { field: "status", operators: ["in", "is", "isNot"] },
  { field: "statusCategory", operators: ["is", "isNot"] },
  { field: "assignee", operators: ["in", "is", "isEmpty"] },
  { field: "priority", operators: ["in", "is"] },
  { field: "fixVersion", operators: ["in", "is", "isEmpty"] },
  { field: "createdAt", operators: ["between", "greaterOrEqual", "lessOrEqual"] },
  { field: "updatedAt", operators: ["between", "greaterOrEqual", "lessOrEqual"] },
  { field: "resolvedAt", operators: ["between", "greaterOrEqual", "lessOrEqual"] },
  { field: "doneAt", operators: ["between", "greaterOrEqual", "lessOrEqual"] },
];
```

Then enrich `JIRA_RESOURCES` entries:

```js
issues: {
  label: "Issues",
  endpoint: "/rest/api/3/search/jql",
  fields: DEFAULT_FIELDS,
  metrics: ISSUE_METRICS,
  dimensions: ISSUE_DIMENSIONS,
  filters: ISSUE_FILTERS,
  transforms: ["raw", "grouped", "created_resolved_trend", "stale_table"],
  dateFields: ISSUE_DATE_FIELDS,
  requires: [],
  canAutoResolve: ["project", "user", "version"],
},
sprint_issues: {
  label: "Sprint issues",
  endpoint: "/rest/agile/1.0/sprint/{sprintId}/issue",
  fields: DEFAULT_FIELDS,
  metrics: SPRINT_METRICS,
  dimensions: SPRINT_DIMENSIONS,
  filters: ISSUE_FILTERS,
  transforms: ["raw", "grouped", "sprint_summary", "stale_table"],
  dateFields: ISSUE_DATE_FIELDS,
  requires: ["sprint"],
  canAutoResolve: ["project", "board", "activeSprint"],
},
```

Add explicit metadata for `boards`, `sprints`, `versions`, `fields`, and `users`:

```js
boards: {
  label: "Boards",
  endpoint: "/rest/agile/1.0/board",
  metrics: ["count"],
  dimensions: ["type", "project"],
  filters: [{ field: "project", operators: ["is"] }, { field: "type", operators: ["is"] }],
  transforms: ["raw"],
  dateFields: [],
  requires: [],
  canAutoResolve: ["project"],
},
sprints: {
  label: "Sprints",
  endpoint: "/rest/agile/1.0/board/{boardId}/sprint",
  metrics: ["count"],
  dimensions: ["state", "board"],
  filters: [{ field: "board", operators: ["is"] }, { field: "state", operators: ["is"] }],
  transforms: ["raw"],
  dateFields: ["startDate", "endDate", "completeDate"],
  requires: ["board"],
  canAutoResolve: ["project", "board"],
},
versions: {
  label: "Versions",
  endpoint: "/rest/api/3/project/{projectIdOrKey}/versions",
  metrics: ["count"],
  dimensions: ["released", "archived", "project"],
  filters: [{ field: "project", operators: ["is"] }, { field: "released", operators: ["is"] }],
  transforms: ["raw"],
  dateFields: ["releaseDate"],
  requires: ["project"],
  canAutoResolve: ["project"],
},
fields: {
  label: "Fields",
  endpoint: "/rest/api/3/field",
  metrics: ["count"],
  dimensions: ["custom", "schema"],
  filters: [{ field: "name", operators: ["contains", "is"] }, { field: "custom", operators: ["is"] }],
  transforms: ["raw"],
  dateFields: [],
  requires: [],
  canAutoResolve: [],
},
users: {
  label: "Users",
  endpoint: "/rest/api/3/user/search",
  metrics: ["count"],
  dimensions: ["active"],
  filters: [{ field: "query", operators: ["contains", "is"] }, { field: "active", operators: ["is"] }],
  transforms: ["raw"],
  dateFields: [],
  requires: [],
  canAutoResolve: [],
},
```

- [ ] **Step 4: Return expanded metadata from Jira AI**

In `server/sources/plugins/jira/ai/jira.ai.js`, define constants near `SOURCE_INSTRUCTIONS`:

```js
const SEMANTIC_INTENTS = [
  "project_overview",
  "sprint_status",
  "sprint_summary",
  "sprint_workload",
  "bug_tracking",
  "bug_breakdown",
  "team_workload",
  "stale_issues",
  "completed_work",
  "release_progress",
  "status_breakdown",
  "priority_breakdown",
  "issue_type_breakdown",
];

const DISCOVERY_TARGETS = [
  "projects",
  "boards",
  "sprints",
  "versions",
  "users",
  "issueTypes",
  "statuses",
  "priorities",
  "fields",
];
```

Update `getCapabilities()`:

```js
supports: {
  modes: ["visual", "jql", "advanced"],
  resources: Object.keys(JIRA_RESOURCES),
  agile: true,
  variables: true,
  pagination: true,
  templates: ["project-overview", "sprint-health", "bug-tracking", "team-workload"],
  chartPlacement: true,
  discovery: DISCOVERY_TARGETS,
  semanticIntents: SEMANTIC_INTENTS,
  metrics: Array.from(new Set(Object.values(JIRA_RESOURCES).flatMap((resource) => resource.metrics || []))),
  dimensions: Array.from(new Set(Object.values(JIRA_RESOURCES).flatMap((resource) => resource.dimensions || []))),
  dateFields: ["createdAt", "updatedAt", "resolvedAt", "doneAt"],
  riskPolicy: {
    preview: "best_match",
    persist: "disambiguate_meaningful_uncertainty",
  },
},
```

Update `listResources()` mapping to include:

```js
metrics: resource.metrics || [],
dimensions: resource.dimensions || [],
filters: resource.filters || [],
dateFields: resource.dateFields || [],
requires: resource.requires || [],
canAutoResolve: resource.canAutoResolve || [],
transforms: resource.transforms || getTransformsForResource(id),
```

- [ ] **Step 5: Run the test and verify it passes**

Run:

```bash
npm run test:run -- tests/unit/jiraAi.test.js
```

Expected: all Jira AI tests pass.

- [ ] **Step 6: Git checkpoint**

Do not run git commands. Raz handles git manually.

---

### Task 2: Add Shared Jira Context Resolver

**Files:**
- Create: `server/sources/plugins/jira/ai/jira.resolver.js`
- Modify: `server/sources/plugins/jira/ai/jira.ai.js`
- Test: `server/tests/unit/jiraAi.test.js`

- [ ] **Step 1: Add failing resolver tests**

Update imports in `server/tests/unit/jiraAi.test.js`:

```js
const jiraResolver = require("../../sources/plugins/jira/ai/jira.resolver");
```

Add tests:

```js
it("resolves exact project, single scrum board, and active sprint", async () => {
  vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
    id: "10001",
    key: "D2371",
    name: "D2371 Project",
  }]);
  vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{
    id: 77,
    name: "D2371 Scrum Board",
    type: "scrum",
  }]);
  vi.spyOn(jiraConnection, "listSprints").mockResolvedValue([{
    id: 123,
    name: "Sprint 14",
    state: "active",
  }]);

  const resolution = await jiraResolver.resolveContext({
    connection: { id: 42 },
    question: "show active sprint status for D2371",
    intent: { id: "sprint_status", resource: "sprint_issues" },
    mode: "preview",
  });

  expect(resolution).toMatchObject({
    needsDisambiguation: false,
    project: { key: "D2371", confidence: 0.98 },
    board: { id: "77", confidence: 0.9 },
    sprint: { id: "123", state: "active", confidence: 0.95 },
  });
});

it("returns sprint alternatives when multiple active sprints are plausible", async () => {
  vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{
    id: 77,
    name: "D2371 Scrum Board",
    type: "scrum",
  }]);
  vi.spyOn(jiraConnection, "listSprints").mockResolvedValue([
    { id: 123, name: "Sprint 14", state: "active" },
    { id: 124, name: "Sprint 15", state: "active" },
  ]);

  const resolution = await jiraResolver.resolveContext({
    connection: { id: 42 },
    question: "show active sprint status for D2371",
    intent: { id: "sprint_status", resource: "sprint_issues" },
    mode: "persist",
  });

  expect(resolution.needsDisambiguation).toBe(true);
  expect(resolution.options).toEqual(expect.arrayContaining([
    expect.objectContaining({ value: "sprint:123" }),
    expect.objectContaining({ value: "sprint:124" }),
  ]));
});

it("resolves versions and users only when requested", async () => {
  const listUsersSpy = vi.spyOn(jiraConnection, "listUsers").mockResolvedValue([{
    accountId: "abc",
    displayName: "Jane Product",
    active: true,
  }]);
  const listVersionsSpy = vi.spyOn(jiraConnection, "listVersions").mockResolvedValue([{
    id: "20001",
    name: "v5.2.0",
    released: false,
  }]);

  const resolution = await jiraResolver.resolveContext({
    connection: { id: 42 },
    question: "show release readiness for D2371 v5.2.0 assigned to Jane",
    intent: { id: "release_progress", resource: "issues", needsVersion: true, needsUser: true },
    mode: "preview",
  });

  expect(listUsersSpy).toHaveBeenCalledWith(expect.any(Object), {
    query: "Jane",
    maxResults: 20,
  });
  expect(listVersionsSpy).toHaveBeenCalledWith(expect.any(Object), {
    projectIdOrKey: "D2371",
  });
  expect(resolution.user).toMatchObject({ accountId: "abc", confidence: 0.8 });
  expect(resolution.version).toMatchObject({ id: "20001", name: "v5.2.0", confidence: 0.9 });
});
```

- [ ] **Step 2: Run tests and verify resolver module is missing**

Run:

```bash
npm run test:run -- tests/unit/jiraAi.test.js
```

Expected: failure because `jira.resolver.js` does not exist.

- [ ] **Step 3: Create resolver module**

Create `server/sources/plugins/jira/ai/jira.resolver.js`:

```js
const jiraConnection = require("../jira.connection");

const PROJECT_TOKEN_IGNORE = new Set(["JIRA", "SCRUM", "SPRINT", "STATUS", "DONE", "OPEN"]);

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function extractProjectKey(question = "", overrides = {}) {
  const explicitProject = overrides.project || overrides.projects || overrides.projectIdOrKey;
  if (explicitProject) {
    return Array.isArray(explicitProject) ? String(explicitProject[0]).trim() : String(explicitProject).split(",")[0].trim();
  }

  const matches = String(question || "").match(/\b[A-Z][A-Z0-9_]{1,12}\b/g) || [];
  return matches.find((match) => !PROJECT_TOKEN_IGNORE.has(match)) || null;
}

function extractAssigneeQuery(question = "", overrides = {}) {
  if (overrides.assigneeName) return String(overrides.assigneeName).trim();
  if (overrides.assignee) return String(overrides.assignee).trim();

  const match = String(question || "").match(/\b(?:assigned to|assignee|by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  return match ? match[1].trim() : "";
}

function extractVersionName(question = "", overrides = {}) {
  if (overrides.fixVersion) return String(overrides.fixVersion).trim();
  if (overrides.version) return String(overrides.version).trim();

  const match = String(question || "").match(/\b(?:version|release|fix version)?\s*(v?\d+(?:\.\d+){1,3}[A-Za-z0-9._-]*)\b/i);
  return match ? match[1].trim() : "";
}

function shouldResolveSprints(intent = {}, question = "") {
  return intent.resource === "sprint_issues" || intent.needsSprint || /\bsprint\b/i.test(question);
}

function shouldResolveUser(intent = {}, question = "") {
  return Boolean(intent.needsUser) || /\b(assignee|assigned to|workload for|by)\b/i.test(question);
}

function shouldResolveVersion(intent = {}, question = "") {
  return Boolean(intent.needsVersion) || /\b(release|version|fix version)\b/i.test(question);
}

function option(label, value, meta = {}) {
  return { label, value, ...meta };
}

function pickBestBoard(boards = []) {
  const scrumBoards = boards.filter((board) => !board.type || board.type === "scrum");
  return scrumBoards[0] || boards[0] || null;
}

function buildEntity(candidate, confidence, extra = {}) {
  if (!candidate) return null;
  return {
    ...extra,
    ...candidate,
    id: candidate.id !== undefined && candidate.id !== null ? String(candidate.id) : candidate.id,
    confidence,
  };
}

async function resolveProject({ connection, projectKey }) {
  if (!projectKey) return { project: null, warnings: [] };

  try {
    const projects = await jiraConnection.listProjects(connection);
    const exact = projects.find((project) => normalizeText(project.key) === normalizeText(projectKey));
    if (exact) {
      return { project: buildEntity(exact, 0.98), warnings: [] };
    }
    const fuzzy = projects.find((project) => normalizeText(project.name).includes(normalizeText(projectKey)));
    if (fuzzy) {
      return { project: buildEntity(fuzzy, 0.75), warnings: [`Using project ${fuzzy.key} as the closest match for ${projectKey}.`] };
    }
  } catch (error) {
    return {
      project: { key: projectKey, name: projectKey, confidence: 0.9 },
      warnings: ["Could not list projects; using the project key from the question."],
    };
  }

  return {
    project: { key: projectKey, name: projectKey, confidence: 0.9 },
    warnings: ["Project was inferred from the question."],
  };
}

async function resolveBoardAndSprint({
  connection, projectKey, overrides = {}, mode = "preview",
}) {
  const warnings = [];
  const options = [];
  let boards = [];

  if (overrides.boardId) {
    boards = [{ id: overrides.boardId, name: `Board ${overrides.boardId}`, type: "scrum" }];
  } else if (projectKey) {
    boards = await jiraConnection.listBoards(connection, {
      projectKeyOrId: projectKey,
      maxResults: 50,
    });
  }

  const board = pickBestBoard(boards);
  const boardAlternatives = boards
    .filter((candidate) => !board || String(candidate.id) !== String(board.id))
    .slice(0, 5)
    .map((candidate) => buildEntity(candidate, 0.65));
  const resolvedBoard = buildEntity(board, boards.length === 1 ? 0.95 : 0.86, { alternatives: boardAlternatives });

  if (!board) {
    return { board: null, sprint: null, warnings: ["No Jira board could be resolved."], options };
  }

  const sprints = await jiraConnection.listSprints(connection, {
    boardId: board.id,
    maxResults: 50,
    state: overrides.sprintState || "active",
  });
  const activeSprints = sprints.filter((sprint) => sprint.state === (overrides.sprintState || "active"));

  if (overrides.sprintId) {
    const exact = sprints.find((sprint) => String(sprint.id) === String(overrides.sprintId)) || { id: overrides.sprintId, name: `Sprint ${overrides.sprintId}`, state: overrides.sprintState || "active" };
    return { board: resolvedBoard, sprint: buildEntity(exact, 0.99), warnings, options };
  }

  if (activeSprints.length === 1) {
    return { board: resolvedBoard, sprint: buildEntity(activeSprints[0], 0.95), warnings, options };
  }

  if (activeSprints.length > 1) {
    const sprintOptions = activeSprints.slice(0, 5).map((sprint) => option(
      `Use ${sprint.name}`,
      `sprint:${sprint.id}`,
      { sprintId: String(sprint.id), boardId: String(board.id) }
    ));
    const firstSprint = buildEntity(activeSprints[0], mode === "preview" ? 0.7 : 0.55, {
      alternatives: activeSprints.slice(1, 5).map((sprint) => buildEntity(sprint, 0.65)),
    });
    return {
      board: resolvedBoard,
      sprint: mode === "preview" ? firstSprint : null,
      warnings: mode === "preview" ? ["Multiple active sprints were found; using the first active sprint for preview."] : warnings,
      options: sprintOptions,
      needsDisambiguation: mode !== "preview",
    };
  }

  return {
    board: resolvedBoard,
    sprint: null,
    warnings: ["No active sprint was found for the resolved board."],
    options: [
      option("Show project status instead", "status_breakdown"),
      option("Help me pick a board or sprint", "pick_board"),
    ],
  };
}

async function resolveUser({ connection, question, overrides, intent }) {
  if (!shouldResolveUser(intent, question)) return null;
  const query = extractAssigneeQuery(question, overrides);
  if (!query) return null;

  const users = await jiraConnection.listUsers(connection, { query, maxResults: 20 });
  const exact = users.find((user) => normalizeText(user.displayName) === normalizeText(query));
  const selected = exact || users[0] || null;
  return buildEntity(selected, exact ? 0.95 : 0.8);
}

async function resolveVersion({ connection, question, overrides, intent, projectKey }) {
  if (!shouldResolveVersion(intent, question) || !projectKey) return null;
  const versionName = extractVersionName(question, overrides);
  if (!versionName) return null;

  const versions = await jiraConnection.listVersions(connection, { projectIdOrKey: projectKey });
  const exact = versions.find((version) => normalizeText(version.name) === normalizeText(versionName));
  const selected = exact || versions.find((version) => normalizeText(version.name).includes(normalizeText(versionName))) || null;
  return buildEntity(selected, exact ? 0.95 : 0.8);
}

async function resolveContext({
  connection,
  question = "",
  overrides = {},
  intent = {},
  mode = "preview",
} = {}) {
  const warnings = [];
  const options = [];
  const projectKey = extractProjectKey(question, overrides);
  const projectResolution = await resolveProject({ connection, projectKey });
  warnings.push(...projectResolution.warnings);

  let boardSprintResolution = {};
  if (shouldResolveSprints(intent, question)) {
    boardSprintResolution = await resolveBoardAndSprint({
      connection,
      projectKey: projectResolution.project?.key || projectKey,
      overrides,
      mode,
    });
    warnings.push(...(boardSprintResolution.warnings || []));
    options.push(...(boardSprintResolution.options || []));
  }

  const user = await resolveUser({ connection, question, overrides, intent });
  const version = await resolveVersion({
    connection,
    question,
    overrides,
    intent,
    projectKey: projectResolution.project?.key || projectKey,
  });

  return {
    project: projectResolution.project,
    board: boardSprintResolution.board || null,
    sprint: boardSprintResolution.sprint || null,
    user,
    version,
    warnings,
    options,
    needsDisambiguation: Boolean(boardSprintResolution.needsDisambiguation),
  };
}

module.exports = {
  extractProjectKey,
  resolveContext,
};
```

- [ ] **Step 4: Remove duplicated active sprint resolver from `jira.ai.js`**

In `server/sources/plugins/jira/ai/jira.ai.js`, add:

```js
const jiraResolver = require("./jira.resolver");
```

Keep the old `extractProjectKey` wrapper temporarily if `buildJql` still uses it:

```js
function extractProjectKey(question = "", overrides = {}) {
  return jiraResolver.extractProjectKey(question, overrides);
}
```

Delete the old `resolveActiveSprint` function from `jira.ai.js`. `planDataset` will be updated in Task 3 to use `jiraResolver.resolveContext`.

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test:run -- tests/unit/jiraAi.test.js
```

Expected: resolver tests pass or fail only where `planDataset` still expects the old `resolveActiveSprint`; Task 3 will complete integration.

- [ ] **Step 6: Git checkpoint**

Do not run git commands. Raz handles git manually.

---

### Task 3: Rework Jira Intent Planning And Planner Contract

**Files:**
- Modify: `server/sources/plugins/jira/ai/jira.ai.js`
- Test: `server/tests/unit/jiraAi.test.js`

- [ ] **Step 1: Add failing planner contract tests**

Add tests to `server/tests/unit/jiraAi.test.js`:

```js
it("returns resolution and correction actions for active sprint status", async () => {
  vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
    id: "10001",
    key: "D2371",
    name: "D2371 Project",
  }]);
  vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{
    id: 77,
    name: "D2371 Scrum Board",
    type: "scrum",
  }]);
  vi.spyOn(jiraConnection, "listSprints").mockResolvedValue([{
    id: 123,
    name: "Sprint 14",
    state: "active",
  }]);

  const plan = await jiraAi.planDataset({
    connection: { id: 42 },
    question: "show me the active sprint status for D2371",
    mode: "preview",
  });

  expect(plan.status).toBe("ok");
  expect(plan.rationale.intent).toBe("sprint_status");
  expect(plan.resolution).toMatchObject({
    project: { key: "D2371" },
    board: { id: "77" },
    sprint: { id: "123" },
  });
  expect(plan.actions).toEqual(expect.arrayContaining([
    expect.objectContaining({ value: "change_sprint" }),
    expect.objectContaining({ value: "group_by_assignee" }),
  ]));
});

it("plans a sprint summary from follow-up overrides", async () => {
  const plan = await jiraAi.planDataset({
    connection: { id: 42 },
    question: "show me a simple sprint summary",
    overrides: {
      project: "D2371",
      boardId: "77",
      sprintId: "123",
    },
    mode: "preview",
  });

  expect(plan.status).toBe("ok");
  expect(plan.rationale.intent).toBe("sprint_summary");
  expect(plan.configuration).toMatchObject({
    resource: "sprint_issues",
    sprintId: "123",
    boardId: "77",
    transform: { type: "sprint_summary" },
  });
  expect(plan.chartSpec.type).toBe("gauge");
});

it("falls back to project status breakdown when active sprint cannot be resolved", async () => {
  vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
    id: "10001",
    key: "D2371",
    name: "D2371 Project",
  }]);
  vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{
    id: 77,
    name: "D2371 Scrum Board",
    type: "scrum",
  }]);
  vi.spyOn(jiraConnection, "listSprints").mockResolvedValue([]);

  const plan = await jiraAi.planDataset({
    connection: { id: 42 },
    question: "show me the active sprint status for D2371",
    mode: "preview",
  });

  expect(plan.status).toBe("fallback");
  expect(plan.message).toContain("project status breakdown");
  expect(plan.configuration).toMatchObject({
    resource: "issues",
    transform: {
      type: "grouped",
      groupBy: "status",
      metric: "count",
    },
  });
  expect(plan.configuration.jql).toContain("project IN (\"D2371\")");
});

it("plans Jira release progress from a version name", async () => {
  vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
    id: "10001",
    key: "D2371",
    name: "D2371 Project",
  }]);
  vi.spyOn(jiraConnection, "listVersions").mockResolvedValue([{
    id: "20001",
    name: "v5.2.0",
    released: false,
  }]);

  const plan = await jiraAi.planDataset({
    connection: { id: 42 },
    question: "show release readiness for D2371 v5.2.0",
    mode: "preview",
  });

  expect(plan.status).toBe("ok");
  expect(plan.rationale.intent).toBe("release_progress");
  expect(plan.configuration.jql).toContain("fixVersion IN (\"v5.2.0\")");
  expect(plan.resolution.version).toMatchObject({ name: "v5.2.0" });
});
```

- [ ] **Step 2: Run tests and verify planner contract fails**

Run:

```bash
npm run test:run -- tests/unit/jiraAi.test.js
```

Expected: failures because planner does not return `resolution`, `actions`, `fallback`, or release progress intent.

- [ ] **Step 3: Add semantic intent resolver in `jira.ai.js`**

Replace `resolveIntent` with:

```js
function resolveIntent(question = "", overrides = {}) {
  const normalizedQuestion = question.toLowerCase();
  const groupBy = overrides.groupBy || inferGroupBy(normalizedQuestion);

  if (overrides.intent) {
    return {
      id: overrides.intent,
      resource: overrides.resource || "issues",
      transform: overrides.transform || { type: "raw" },
      chartType: overrides.chartType || "table",
    };
  }

  if (normalizedQuestion.includes("release") || normalizedQuestion.includes("version") || normalizedQuestion.includes("fix version")) {
    return {
      id: "release_progress",
      resource: "issues",
      needsVersion: true,
      transform: { type: "grouped", groupBy: "statusCategory", metric: "count" },
      chartType: "bar",
    };
  }

  if (normalizedQuestion.includes("sprint")) {
    const asksForSummary = normalizedQuestion.includes("summary")
      || normalizedQuestion.includes("completion")
      || normalizedQuestion.includes("health");
    const sprintMetric = ["status", "statusCategory"].includes(groupBy) ? "count" : "storyPoints";
    return {
      id: asksForSummary ? "sprint_summary" : "sprint_status",
      resource: "sprint_issues",
      needsSprint: true,
      transform: asksForSummary
        ? { type: "sprint_summary" }
        : { type: "grouped", groupBy: groupBy || "status", metric: overrides.metric || sprintMetric },
      chartType: asksForSummary ? "gauge" : "bar",
    };
  }

  if (normalizedQuestion.includes("bug") || normalizedQuestion.includes("defect")) {
    return {
      id: "bug_breakdown",
      resource: "issues",
      issueType: "Bug",
      transform: { type: "grouped", groupBy: groupBy || "priority", metric: "count" },
      chartType: "bar",
    };
  }

  if (normalizedQuestion.includes("stale") || normalizedQuestion.includes("stuck") || normalizedQuestion.includes("oldest")) {
    return {
      id: "stale_issues",
      resource: "issues",
      transform: { type: "stale_table" },
      chartType: "table",
    };
  }

  if (normalizedQuestion.includes("completed") || normalizedQuestion.includes("done") || normalizedQuestion.includes("recent")) {
    return {
      id: "completed_work",
      resource: "issues",
      transform: normalizedQuestion.includes("trend")
        ? { type: "created_resolved_trend", interval: overrides.interval || inferInterval(normalizedQuestion) }
        : { type: "raw" },
      chartType: normalizedQuestion.includes("trend") ? "line" : "table",
    };
  }

  if (normalizedQuestion.includes("workload") || normalizedQuestion.includes("assignee") || normalizedQuestion.includes("team load")) {
    return {
      id: "team_workload",
      resource: "issues",
      transform: { type: "grouped", groupBy: "assignee", metric: "count" },
      chartType: "bar",
    };
  }

  if (normalizedQuestion.includes("created vs resolved") || normalizedQuestion.includes("created and resolved") || normalizedQuestion.includes("trend") || normalizedQuestion.includes("over time")) {
    return {
      id: "created_done_trend",
      resource: "issues",
      transform: {
        type: "created_resolved_trend",
        interval: overrides.interval || inferInterval(normalizedQuestion),
      },
      chartType: "line",
    };
  }

  if (groupBy) {
    return {
      id: "issue_breakdown",
      resource: "issues",
      transform: { type: "grouped", groupBy, metric: overrides.metric || "count" },
      chartType: normalizedQuestion.includes("doughnut") || normalizedQuestion.includes("donut") ? "doughnut" : "bar",
    };
  }

  if (normalizedQuestion.includes("table") || normalizedQuestion.includes("latest")) {
    return {
      id: "issue_table",
      resource: "issues",
      transform: { type: "raw" },
      chartType: "table",
    };
  }

  return {
    id: "project_overview",
    resource: "issues",
    transform: { type: "raw" },
    chartType: "kpi",
  };
}
```

- [ ] **Step 4: Add action and fallback helpers**

Add these helpers in `jira.ai.js` above `planDataset`:

```js
function buildActions(intent, resolution = {}) {
  const actions = [];

  if (intent.resource === "sprint_issues") {
    actions.push({ label: "Use a different sprint", value: "change_sprint" });
    actions.push({ label: "Break down by assignee", value: "group_by_assignee" });
  }

  if (resolution.project?.key) {
    actions.push({
      label: `Show ${resolution.project.key} project status instead`,
      value: "status_breakdown",
    });
  }

  if (intent.id !== "issue_table") {
    actions.push({ label: "Show issue table", value: "show_table" });
  }

  return actions;
}

function buildProjectStatusFallback({ question, overrides, resolution, reason }) {
  const projectKey = resolution.project?.key || extractProjectKey(question, overrides) || "{{projects}}";
  const configuration = {
    source: SOURCE_ID,
    resource: "issues",
    mode: "visual",
    jql: buildJql({
      question,
      overrides: {
        ...overrides,
        projects: projectKey,
      },
      intent: { resource: "issues" },
    }),
    fields: DEFAULT_FIELDS,
    transform: { type: "grouped", groupBy: "status", metric: "count" },
    pagination: {
      ...DEFAULT_PAGINATION,
      ...(overrides.pagination || {}),
    },
  };
  const validation = validateConfiguration(configuration);
  const chartSpec = getChartSpec(validation.configuration, question, "bar");

  return {
    status: "fallback",
    source: SOURCE_ID,
    message: reason || `I could not resolve the active sprint, so I used the ${projectKey} project status breakdown instead.`,
    datasetName: chartSpec.title,
    configuration: validation.configuration,
    chartSpec,
    outputFields: getOutputFields(validation.configuration),
    resolution,
    actions: buildActions({ id: "issue_breakdown", resource: "issues" }, resolution),
    warnings: validation.warnings,
    errors: validation.errors,
    rationale: {
      intent: "status_breakdown_fallback",
      resource: "issues",
      mode: validation.configuration.mode,
      transform: validation.configuration.transform,
    },
  };
}
```

- [ ] **Step 5: Update `planDataset` to use resolver**

Replace the sprint-resolution block in `planDataset` with:

```js
const intent = resolveIntent(question, overrides);
const normalizedQuestion = question.toLowerCase();
const issueType = overrides.issueType || intent.issueType || (normalizedQuestion.includes("bug") || normalizedQuestion.includes("defect") ? "Bug" : undefined);
const resolution = await jiraResolver.resolveContext({
  connection,
  question,
  overrides,
  intent,
  mode: overrides.modeContext || "preview",
});

if (resolution.needsDisambiguation) {
  return {
    status: "needs_disambiguation",
    source: SOURCE_ID,
    message: resolution.message || "I found multiple Jira matches. Which one should I use?",
    options: resolution.options || [],
    resolution,
  };
}

if (intent.resource === "sprint_issues" && !resolution.sprint?.id) {
  return buildProjectStatusFallback({
    question,
    overrides,
    resolution,
    reason: resolution.project?.key
      ? `I could not resolve the active sprint, so I used the ${resolution.project.key} project status breakdown instead.`
      : "I could not resolve the active sprint, so I used a project status breakdown instead.",
  });
}

const sprintId = resolution.sprint?.id || overrides.sprintId || "{{sprint_id}}";
const boardId = resolution.board?.id || overrides.boardId || "{{board_id}}";
const projectKey = resolution.project?.key || overrides.projects || overrides.project || "{{projects}}";
const fixVersion = resolution.version?.name || overrides.fixVersion;
```

Then in the config object:

```js
jql: buildJql({
  question,
  overrides: {
    ...overrides,
    projects: projectKey,
    fixVersion,
  },
  intent: {
    resource: intent.resource,
    issueType,
    priority: normalizedQuestion.includes("blocker") ? "Blocker" : undefined,
  },
}),
sprintId,
boardId,
projectIdOrKey: projectKey,
transform: overrides.transform || intent.transform,
includeDoneAt: ["completed_work", "created_done_trend", "sprint_summary"].includes(intent.id) || overrides.includeDoneAt,
```

Return the expanded contract:

```js
rationale: {
  intent: intent.id,
  resource: validation.configuration.resource,
  mode: validation.configuration.mode,
  transform: validation.configuration.transform,
  issueType,
},
resolution,
actions: buildActions(intent, resolution),
warnings: [
  ...validation.warnings,
  ...(resolution.warnings || []),
],
```

- [ ] **Step 6: Run planner tests**

Run:

```bash
npm run test:run -- tests/unit/jiraAi.test.js
```

Expected: all Jira AI planner tests pass.

- [ ] **Step 7: Git checkpoint**

Do not run git commands. Raz handles git manually.

---

### Task 4: Add Generic Source Context Resolution Tool

**Files:**
- Modify: `server/modules/ai/orchestrator/tools/sourceTools.js`
- Modify: `server/modules/ai/orchestrator/tools/index.js`
- Modify: `server/modules/ai/orchestrator/orchestrator.js`
- Modify: `server/sources/plugins/jira/ai/jira.ai.js`
- Test: `server/tests/unit/sourceAiHarness.test.js`
- Test: `server/tests/unit/orchestratorResponsesApi.test.js`

- [ ] **Step 1: Add failing source tool test**

In `server/tests/unit/sourceAiHarness.test.js`, import the new tool:

```js
const {
  sourceGetCapabilities,
  sourceGetSampleData,
  sourceListResources,
  sourceListTemplates,
  sourcePlanDataset,
  sourcePreviewConfiguration,
  sourceRecommendTemplates,
  sourceResolveContext,
  sourceValidateConfiguration,
} = require("../../modules/ai/orchestrator/tools/sourceTools");
```

Add:

```js
it("routes generic source context resolution to Jira AI", async () => {
  vi.spyOn(db.Connection, "findOne").mockResolvedValue(toolHarnessConnections.jira);
  vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
    id: "10001",
    key: "D2371",
    name: "D2371 Project",
  }]);
  vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{
    id: 77,
    name: "D2371 Scrum Board",
    type: "scrum",
  }]);
  vi.spyOn(jiraConnection, "listSprints").mockResolvedValue([{
    id: 123,
    name: "Sprint 14",
    state: "active",
  }]);

  const result = await sourceResolveContext({
    team_id: TOOL_TEAM_ID,
    connection_id: toolHarnessConnections.jira.id,
    source_id: "jira",
    question: "show active sprint status for D2371",
    intent: { id: "sprint_status", resource: "sprint_issues" },
    mode: "preview",
  });

  expect(result).toMatchObject({
    source: "jira",
    resolution: {
      project: { key: "D2371" },
      board: { id: "77" },
      sprint: { id: "123" },
    },
  });
  expectToolOutputContract(result);
});
```

- [ ] **Step 2: Add failing orchestrator tool definition test**

In `server/tests/unit/orchestratorResponsesApi.test.js`, add:

```js
it("advertises generic source context resolution", async () => {
  const tools = await availableTools();
  const tool = tools.find((candidate) => candidate.name === "source_resolve_context");

  expect(tool).toMatchObject({
    name: "source_resolve_context",
    displayName: "Resolve source context",
  });
  expect(tool.parameters.required).toEqual(expect.arrayContaining(["connection_id", "question"]));
});
```

Import `availableTools` at the top if it is not already imported:

```js
const {
  availableTools,
  buildResponseInputFromMessages,
  buildAssistantMessageFromResponse,
  buildDisambiguationAssistantMessage,
  buildFallbackAssistantMessage,
  sanitizeToolError,
  buildUsageRecordFromResponse,
} = require("../../modules/ai/orchestrator/orchestrator");
```

- [ ] **Step 3: Run tests and verify failures**

Run:

```bash
npm run test:run -- tests/unit/sourceAiHarness.test.js tests/unit/orchestratorResponsesApi.test.js
```

Expected: failures because `sourceResolveContext` and `source_resolve_context` do not exist.

- [ ] **Step 4: Export `resolveContext` from Jira AI**

In `server/sources/plugins/jira/ai/jira.ai.js`, add:

```js
async function resolveContext({
  connection,
  question = "",
  overrides = {},
  intent = {},
  mode = "preview",
} = {}) {
  const resolution = await jiraResolver.resolveContext({
    connection,
    question,
    overrides,
    intent,
    mode,
  });

  return {
    source: SOURCE_ID,
    resolution,
  };
}
```

Export it:

```js
resolveContext,
```

- [ ] **Step 5: Add source tool plumbing**

In `server/modules/ai/orchestrator/tools/sourceTools.js`, add:

```js
async function sourceResolveContext(payload) {
  const { connection, source } = await getScopedSource(payload);
  const tool = requireAiTool(source, "resolveContext");

  return tool({
    connection,
    question: mergeQuestionContext(payload.question, payload.original_question),
    overrides: payload.overrides || {},
    intent: payload.intent || {},
    mode: payload.mode || "preview",
  });
}
```

Export it:

```js
sourceResolveContext,
```

In `server/modules/ai/orchestrator/tools/index.js`, import/export `sourceResolveContext` with the other source tools.

- [ ] **Step 6: Add orchestrator tool definition and routing**

In `server/modules/ai/orchestrator/orchestrator.js`, import `sourceResolveContext` from `./tools`.

Add `"source_resolve_context"` to `TEAM_SCOPED_TOOLS` and `ORIGINAL_QUESTION_TOOLS`.

Add this available tool near the other source tools:

```js
{
  name: "source_resolve_context",
  displayName: "Resolve source context",
  description: "Resolve source-owned business context such as Jira projects, boards, sprints, versions, and users without asking for raw IDs. Use this for corrections, follow-ups, or explicit context inspection.",
  parameters: {
    type: "object",
    properties: {
      source_id: { type: "string", enum: supportedSourceIds },
      connection_id: { type: "string" },
      question: { type: "string" },
      intent: { type: "object" },
      overrides: { type: "object" },
      mode: { type: "string", enum: ["preview", "persist"], default: "preview" }
    },
    required: ["connection_id", "question"]
  }
}
```

Add routing in `callTool`:

```js
case "source_resolve_context":
  return sourceResolveContext(payload);
```

Update source-owned prompt guidance:

```txt
* Use source_resolve_context when a Jira follow-up needs to inspect or correct project, board, sprint, version, or user context.
```

- [ ] **Step 7: Run source/orchestrator tests**

Run:

```bash
npm run test:run -- tests/unit/sourceAiHarness.test.js tests/unit/orchestratorResponsesApi.test.js
```

Expected: both test files pass.

- [ ] **Step 8: Git checkpoint**

Do not run git commands. Raz handles git manually.

---

### Task 5: Make Fallback Plans Preview-Safe In Source Tools

**Files:**
- Modify: `server/modules/ai/orchestrator/tools/sourceTools.js`
- Modify: `server/sources/plugins/jira/ai/jira.ai.js`
- Test: `server/tests/unit/sourceAiHarness.test.js`
- Test: `server/tests/unit/jiraAi.test.js`

- [ ] **Step 1: Add failing fallback contract test**

Add to `server/tests/unit/sourceAiHarness.test.js`:

```js
it("keeps Jira fallback plans usable for preview", async () => {
  vi.spyOn(db.Connection, "findOne").mockResolvedValue(toolHarnessConnections.jira);
  vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
    id: "10001",
    key: "D2371",
    name: "D2371 Project",
  }]);
  vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{
    id: 77,
    name: "D2371 Scrum Board",
    type: "scrum",
  }]);
  vi.spyOn(jiraConnection, "listSprints").mockResolvedValue([]);

  const plan = await sourcePlanDataset({
    team_id: TOOL_TEAM_ID,
    connection_id: toolHarnessConnections.jira.id,
    source_id: "jira",
    question: "show active sprint status for D2371",
    mode: "preview",
  });

  expect(plan.status).toBe("fallback");
  expect(plan.configuration).toMatchObject({
    source: "jira",
    resource: "issues",
  });
  expect(plan.chartSpec).toMatchObject({
    type: "bar",
    xAxis: "root[].status",
    yAxis: "root[].issueCount",
  });
  expect(plan.needs_user_input).toBeUndefined();
  expectToolOutputContract(plan);
});
```

- [ ] **Step 2: Run test and verify current behavior fails**

Run:

```bash
npm run test:run -- tests/unit/sourceAiHarness.test.js
```

Expected: failure if `sourcePlanDataset` does not pass `mode`, or fallback does not produce a usable plan.

- [ ] **Step 3: Pass risk mode into planner**

In `server/modules/ai/orchestrator/tools/sourceTools.js`, update `sourcePlanDataset` tool call:

```js
const result = await tool({
  connection,
  question: mergeQuestionContext(payload.question, payload.original_question),
  overrides: payload.overrides || {},
  mode: payload.mode || "preview",
});
```

In `jira.ai.js`, update `planDataset` signature:

```js
async function planDataset({
  connection = null,
  question = "",
  overrides = {},
  mode = "preview",
} = {}) {
```

Then pass mode to resolver:

```js
mode: overrides.modeContext || mode,
```

- [ ] **Step 4: Ensure fallback plans are not treated as disambiguation**

Keep this sourceTools behavior unchanged except for `needs_disambiguation`:

```js
if (result?.status === "needs_disambiguation") {
  return {
    ...result,
    needs_user_input: true,
    prompt: result.message || "Choose an option before I continue.",
    options: Array.isArray(result.options) ? result.options : [],
  };
}
```

Confirm no branch maps `fallback` to `needs_user_input`.

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test:run -- tests/unit/sourceAiHarness.test.js tests/unit/jiraAi.test.js
```

Expected: fallback plans are valid and source-owned harness tests pass.

- [ ] **Step 6: Git checkpoint**

Do not run git commands. Raz handles git manually.

---

### Task 6: Add Preview Failure Fallback For Sprint Issue Previews

**Files:**
- Modify: `server/sources/plugins/jira/ai/jira.ai.js`
- Test: `server/tests/unit/jiraAi.test.js`

- [ ] **Step 1: Add failing preview fallback test**

Add to `server/tests/unit/jiraAi.test.js`:

```js
it("falls back to project status when sprint issue preview fails", async () => {
  const fetchSpy = vi.spyOn(require("../../sources/plugins/jira/jira.protocol"), "fetchJiraRows");
  fetchSpy
    .mockRejectedValueOnce(new Error("400 - The sprint field is invalid"))
    .mockResolvedValueOnce([{
      key: "D2371-1",
      fields: {
        summary: "Fallback issue",
        project: { key: "D2371" },
        issuetype: { name: "Story" },
        status: { name: "Done", statusCategory: { name: "Done", key: "done" } },
        created: "2026-05-01T00:00:00.000Z",
        updated: "2026-05-02T00:00:00.000Z",
      },
    }]);

  const preview = await jiraAi.previewConfiguration({
    connection: { id: 42 },
    rowLimit: 5,
    configuration: {
      source: "jira",
      resource: "sprint_issues",
      mode: "visual",
      jql: "project IN (\"D2371\") ORDER BY updated DESC",
      fields: ["key", "summary", "status", "project", "issuetype", "created", "updated"],
      sprintId: "123",
      boardId: "77",
      projectIdOrKey: "D2371",
      transform: { type: "grouped", groupBy: "status", metric: "count" },
      pagination: { startAt: 0, maxResults: 100, maxRecords: 5 },
    },
  });

  expect(preview.status).toBe("fallback");
  expect(preview.message).toContain("project status breakdown");
  expect(preview.rows).toEqual([{ status: "Done", issueCount: 1, storyPoints: 0 }]);
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
npm run test:run -- tests/unit/jiraAi.test.js
```

Expected: failure because `previewConfiguration` currently throws the first sprint preview error.

- [ ] **Step 3: Add preview fallback helper**

In `jira.ai.js`, add:

```js
function getProjectStatusFallbackConfiguration(configuration = {}) {
  const projectKey = configuration.projectIdOrKey && !String(configuration.projectIdOrKey).includes("{{")
    ? configuration.projectIdOrKey
    : "{{projects}}";

  return {
    ...configuration,
    resource: "issues",
    sprintId: undefined,
    boardId: undefined,
    projectIdOrKey: projectKey,
    jql: buildJql({
      question: "project status breakdown",
      overrides: { projects: projectKey },
      intent: { resource: "issues" },
    }),
    transform: { type: "grouped", groupBy: "status", metric: "count" },
  };
}
```

- [ ] **Step 4: Catch sprint preview errors and fallback**

In `previewConfiguration`, wrap the `jiraProtocol.fetchJiraRows` call:

```js
let jiraRows;
let fallbackMessage = null;
let previewConfigToUse = previewConfig;

try {
  jiraRows = await jiraProtocol.fetchJiraRows(connection, previewConfigToUse);
} catch (error) {
  if (previewConfig.resource !== "sprint_issues") {
    throw error;
  }

  previewConfigToUse = getProjectStatusFallbackConfiguration(previewConfig);
  jiraRows = await jiraProtocol.fetchJiraRows(connection, previewConfigToUse);
  fallbackMessage = "I could not preview sprint issues, so I used the project status breakdown instead.";
}
```

Then use `previewConfigToUse` for normalization, transformation, columns, and chart spec:

```js
const normalizedRows = ["issues", "sprint_issues"].includes(previewConfigToUse.resource)
  ? jiraRows.map((issue) => jiraProtocol.normalizeIssue(issue, connection?.options?.jira?.fieldMappings || {}))
  : jiraRows;
const rows = jiraProtocol.transformRows(normalizedRows, previewConfigToUse);
```

Return:

```js
return {
  status: fallbackMessage ? "fallback" : "ok",
  message: fallbackMessage || undefined,
  rows: rows.slice(0, rowLimit),
  columns: buildColumns(rows, previewConfigToUse),
  rowCount: rows.length,
  warnings: validation.warnings,
  chartSpec: getChartSpec(previewConfigToUse, ""),
};
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test:run -- tests/unit/jiraAi.test.js
```

Expected: all Jira AI tests pass.

- [ ] **Step 6: Git checkpoint**

Do not run git commands. Raz handles git manually.

---

### Task 7: Full Verification

**Files:**
- Verify all modified Jira AI/orchestrator test files.

- [ ] **Step 1: Run focused unit test suite**

Run:

```bash
npm run test:run -- tests/unit/jiraAi.test.js tests/unit/jiraProtocol.test.js tests/unit/jiraTemplates.test.js tests/unit/sourceAiHarness.test.js tests/unit/orchestratorResponsesApi.test.js tests/unit/updateAudit.test.js
```

Expected: all listed tests pass.

- [ ] **Step 2: Run source registry and plugin structure tests**

Run:

```bash
npm run test:run -- tests/unit/sourceRegistry.test.js tests/unit/sourcePluginStructure.test.js
```

Expected: all listed tests pass.

- [ ] **Step 3: Review source guide consistency**

Read:

```bash
sed -n '1,220p' source-plugin-guide.md
```

Expected: Jira AI remains source-owned, templates stay source-owned, and no generic API route or builder behavior is introduced.

- [ ] **Step 4: Search for accidental Jira generic query usage**

Run:

```bash
rg -n "run_query|generate_query|source_resolve_context|resolveContext" server/modules/ai/orchestrator server/sources/plugins/jira server/tests/unit
```

Expected:

- Jira source-owned paths mention `source_resolve_context`, `source_plan_dataset`, `source_preview_configuration`, and `resolveContext`.
- Jira docs/tests may mention `run_query` only as a forbidden guard.
- No Jira planner code calls `generate_query` or `run_query`.

- [ ] **Step 5: Manual behavior smoke check through unit-level planner calls**

Run:

```bash
node -e "const jiraAi=require('./sources/plugins/jira/ai/jira.ai'); jiraAi.planDataset({question:'show bugs by priority for D2371', overrides:{project:'D2371'}}).then((p)=>console.log(JSON.stringify({status:p.status,resource:p.configuration.resource,jql:p.configuration.jql,chart:p.chartSpec.type}, null, 2)))"
```

Expected output contains:

```json
{
  "status": "ok",
  "resource": "issues",
  "chart": "bar"
}
```

The exact JQL should include `project IN ("D2371")` and `issuetype = "Bug"`.

- [ ] **Step 6: Git checkpoint**

Do not run git commands. Raz handles git manually.
