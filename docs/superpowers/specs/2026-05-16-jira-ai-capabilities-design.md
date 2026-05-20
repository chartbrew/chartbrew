# Jira AI Capabilities Design

Date: 2026-05-16

## Goal

Revise the Jira source AI layer so the orchestrator can answer vague Jira questions by taking initiative, resolving missing Jira context, and returning useful previews without expecting users to know Jira board IDs, sprint IDs, account IDs, or version IDs.

The Jira source should stay source-owned. The AI should plan Jira `DataRequest.configuration` objects and chart specs, not generic API routes or generic queries.

## Current Gap

Stripe Official exposes a semantic AI surface: source instructions, resources, metrics, dimensions, filters, compiled metrics, validation, repair, and compact preview behavior. Jira currently has a thinner planner with some hidden sprint resolution. That makes simple prompts like “show me the active sprint status for D2371” fragile because the orchestrator does not have enough structured capability information or reusable discovery behavior.

## Chosen Approach

Use a hybrid capability layer.

Jira should expose explicit discovery capabilities, but `source_plan_dataset` should also run the common discovery path automatically. The orchestrator gets flexibility when it needs it, while straightforward vague questions still work through a single planning call.

Rejected alternatives:

- Planner-only: simpler orchestration, but too much opaque behavior inside one large planner.
- Tool-only: more transparent, but produces long fragile tool chains and expects the model to sequence Jira discovery perfectly.

## Architecture

Jira AI should have two layers.

The high-level planner remains the default path:

```txt
source_plan_dataset -> source_preview_configuration -> create_temporary_chart
```

For Jira business questions, the orchestrator should call `source_plan_dataset` first. The planner should infer intent, resolve missing Jira context, generate a configuration, and return chart bindings.

The explicit discovery/actions layer should be available for follow-ups, correction flows, and advanced orchestration:

- `resolveJiraContext`
- `listProjects`
- `listBoards`
- `listSprints`
- `listVersions`
- `listUsers`
- `listIssueTypes`
- `listStatuses`
- `listFields`
- `validateJql`
- `previewJql`

Both layers should share a Jira AI resolver module so context resolution is consistent and testable.

## Capability Model

`getCapabilities()` should describe what Jira AI can safely build, not just that Jira has resources.

It should include:

- `resources`: issues, sprint issues, boards, sprints, versions, users, fields.
- `discovery`: projects, boards, active/future/closed sprints, versions, users, issue types, statuses, priorities, custom field mappings.
- `semanticIntents`: project overview, sprint status, sprint summary, sprint workload, bug tracking, stale work, recently completed work, release progress, assignee workload, status breakdown, priority breakdown, issue type breakdown.
- `metrics`: issue count, story points, completion rate, completed story points, average lead time, average cycle time when data is available.
- `dimensions`: date, status, status category, assignee, priority, issue type, project, sprint, fix version, epic/parent, label.
- `dateFields`: createdAt, updatedAt, resolvedAt, doneAt when done-date fetching is enabled.
- `riskPolicy`: previews may proceed with a best match; saved charts and dashboards should disambiguate meaningful uncertainty.

`listResources()` should follow the Stripe Official pattern and include metrics, dimensions, filters, transforms, date fields, discovery requirements, and whether IDs can be auto-resolved.

Example:

```js
{
  id: "sprint_issues",
  label: "Sprint issues",
  requires: ["sprint"],
  canAutoResolve: ["project", "board", "activeSprint"],
  metrics: ["count", "storyPoints", "completionRate"],
  dimensions: ["status", "statusCategory", "assignee", "priority", "issueType"],
  transforms: ["raw", "grouped", "sprint_summary", "stale_table"],
  dateFields: ["createdAt", "updatedAt", "resolvedAt", "doneAt"]
}
```

## Context Resolution

Add a dedicated resolver used by both the planner and explicit discovery tools.

Input:

```js
{
  question,
  overrides,
  intent,
  connection,
  mode: "preview" | "persist"
}
```

Resolution order:

1. Parse hints from the question:
   - project keys such as `D2371`
   - sprint state words such as active, current, latest, closed, future
   - Jira resource words such as sprint, bug, release, workload
   - assignee or reporter names
   - version/release names
   - issue type, status, and priority terms
2. Query Jira only for missing context:
   - exact project key lookup first
   - project search fallback by name/key
   - boards for the selected project
   - sprints for selected boards
   - versions for selected project
   - users only when user wording exists
   - fields only when story points, severity, team, or custom field mapping is needed
3. Score candidates:
   - exact project key: very high confidence
   - one board for a project: high confidence
   - one active sprint on a scrum board: high confidence
   - multiple active sprints: ambiguous
   - fuzzy user/version matches: medium unless exact display/name match
4. Decide:
   - Preview/show requests can proceed with the best match when confidence is acceptable.
   - Persist/save/dashboard requests should ask when ambiguity affects saved data.
   - No useful match should return disambiguation options that move the task forward.

Resolver output:

```js
{
  project: { key: "D2371", name: "D2371", confidence: 0.98 },
  board: { id: 77, name: "D2371 Scrum Board", confidence: 0.86, alternatives: [] },
  sprint: { id: 123, name: "Sprint 14", state: "active", confidence: 0.93 },
  warnings: [],
  needsDisambiguation: false
}
```

## Planning Behavior

Planner stages:

1. Detect semantic intent.
2. Resolve Jira context.
3. Generate `DataRequest.configuration`.
4. Generate chart spec bindings.
5. Return a compact result contract.

Supported intents for v1:

- `sprint_status`
- `sprint_summary`
- `sprint_workload`
- `team_workload`
- `stale_issues`
- `bug_breakdown`
- `release_progress`
- `completed_work`
- `created_done_trend`
- `issue_breakdown`
- `issue_table`

Planner result contract:

```js
{
  status: "ok" | "fallback" | "needs_disambiguation" | "invalid",
  source: "jira",
  datasetName,
  configuration,
  chartSpec,
  outputFields,
  resolution,
  actions,
  warnings,
  errors,
  rationale
}
```

The `actions` array should power quick correction options:

```js
[
  { label: "Use a different sprint", value: "change_sprint" },
  { label: "Break down by assignee", value: "group_by_assignee" }
]
```

For “show me the active sprint status for D2371 in Jira”, the planner should resolve the project, board, and active sprint automatically and return:

```js
{
  resource: "sprint_issues",
  project: "D2371",
  boardId: "77",
  sprintId: "123",
  transform: { type: "grouped", groupBy: "status", metric: "count" },
  chartType: "bar"
}
```

## Orchestrator Behavior

The orchestrator should treat Jira as a source-owned configuration source.

Rules:

- Use `source_plan_dataset` first for Jira business questions.
- Use discovery tools when a follow-up needs to inspect or correct context.
- Do not ask for board IDs, sprint IDs, version IDs, or account IDs unless Jira cannot resolve them.
- For low-risk previews, proceed with the best match and explain what was used.
- For saved charts and dashboards, disambiguate meaningful uncertainty.
- Never use `generate_query` or `run_query` for Jira source-owned configurations.
- Treat `fallback` planner results as usable for preview and temporary chart creation.

## Fallbacks

Jira AI should avoid dead ends.

Fallback rules:

- If active sprint cannot be resolved but project can, fallback to project status breakdown or open issues by assignee.
- If board is ambiguous, preview may choose the best scrum board when confidence is acceptable, but persisted charts should ask.
- If sprint issue preview fails and `sprintId` is known, retry with a safer sprint issue config without extra JQL.
- If sprint issue preview still fails, fallback to project-level JQL status breakdown.
- If done-date fetching is needed but unavailable or too expensive, fallback to `resolutiondate` or `statusCategoryChangedDate` where possible and warn.
- If user/version/assignee matching is ambiguous, preview may use no filter or the strongest exact match; persisted charts should ask.

Fallback response shape:

```js
{
  status: "fallback",
  message: "I could not resolve the active sprint, so I used the D2371 project status breakdown instead.",
  configuration,
  chartSpec,
  resolution,
  actions
}
```

## Testing

Unit tests should cover:

- `resolveContext` exact project key resolution.
- Single board resolution for a project.
- Single active sprint resolution.
- Multiple board/sprint alternatives.
- No active sprint with project-level fallback.
- User/version resolution only when requested.
- No secret leakage in failed discovery.
- Planning active sprint status from “active sprint status for D2371”.
- Planning “simple sprint summary” using prior sprint/project overrides.
- Planning bug breakdowns, workload, stale issues, recently completed work, and release progress.
- Planner returns `resolution`, `actions`, `rationale`, and valid chart specs.
- Fallback configurations are valid and preview-safe.
- Source tools pass preview/persist risk context.
- Orchestrator renders disambiguation options.
- Orchestrator never uses `run_query` for Jira.
- Orchestrator proceeds with preview for `fallback` plans.
- Persisted/dashboard creation asks when ambiguity is meaningful.

## Acceptance Criteria

- A user can ask “show me the active sprint status for D2371 in Jira” and get a useful preview without knowing board or sprint IDs.
- A user can ask “show me a simple sprint summary” as a follow-up and Jira reuses prior resolved context.
- A user can ask “show bugs by priority” and get a valid Jira configuration and chart with minimal extra input.
- Release, workload, stale, and completed-work questions produce sensible default plans.
- Ambiguity produces quick correction options instead of silent failure.
- Jira API failures never expose auth headers or raw request objects.
- Jira AI behavior remains source-owned and consistent with the source plugin guide.

