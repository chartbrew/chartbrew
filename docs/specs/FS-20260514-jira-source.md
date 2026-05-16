# Jira Source Plugin

Status: draft

## Goal

Add Jira Cloud as a first-class Chartbrew source with custom connection setup, custom dataset builder, plugin-owned templates, normalized runtime output, and source-owned AI planning.

Jira must be treated as a custom source family, not as a branded generic API source. Users should configure Jira concepts such as projects, boards, sprints, JQL, issue fields, and template bundles. They should not need to build raw REST requests unless they intentionally use an advanced Jira mode.

## Source Identity

Jira uses a custom source identity:

```js
{
  id: "jira",
  type: "jira",
  subType: "jira",
}
```

This follows the same custom-source pattern as Stripe Official. Jira may call HTTP APIs internally, but it must not use the generic `api` protocol or generic API builder.

## Scope

Included in v1:

- Jira Cloud only.
- Email, API token, and Jira site URL authentication.
- Custom backend plugin, protocol, connection helper, resources module, templates, and AI module.
- Custom frontend source definition, connection form, builder, and template setup UI.
- Issues and JQL support.
- Jira Agile API support for boards, sprints, and sprint issues.
- Sprint summary analytics, including completion, story points completed, carryover, assignee workload, and sprint status.
- Field mapping for story points, severity, and team fields.
- Separate built-in template bundles for project overview, sprint health, bug tracking, and team workload.
- Source-owned AI planner covering the same resources and configuration surface as the manual builder.

Out of scope for v1:

- OAuth.
- Jira Data Center or Jira Server.
- True sprint burndown from changelog/status transition history.
- Deep cycle-time analytics based on transition history.
- Writing data back to Jira.
- Arbitrary Jira REST request building.
- A Jira-specific dashboard creation AI tool.

Side quest:

- Add a generic AI orchestration tool for creating dashboards/projects from registered source chart templates. The tool should not be Jira-specific. Jira should use it when available, and existing source AI layers such as Stripe Official should be able to adopt it later.

## Backend Layout

Add Jira under the source plugin tree:

```txt
server/sources/plugins/jira/
  jira.plugin.js
  jira.protocol.js
  jira.connection.js
  jira.resources.js
  ai/jira.ai.js
  templates/
    project-overview.json
    sprint-health.json
    bug-tracking.json
    team-workload.json
```

Register the plugin in `server/sources/index.js` and follow `source-plugin-guide.md`.

The plugin should expose capabilities similar to:

```js
{
  connection: {
    supportsTest: true,
    supportsOAuth: false,
    supportsFiles: false,
    authModes: ["api_token"],
  },
  data: {
    supportsQuery: false,
    supportsSchema: true,
    supportsResourcePicker: true,
    supportsPagination: true,
    supportsVariables: true,
    supportsJoins: true,
  },
  templates: {
    datasets: true,
    charts: true,
    dashboards: false,
  },
  ai: {
    canGenerateDatasets: true,
    canGenerateQueries: false,
    hasSourceInstructions: true,
    hasTools: true,
  },
}
```

Jira must not add helper routes. Source-specific metadata and preview operations should go through the existing source action route:

```txt
POST /team/:team_id/connections/:connection_id/source-action
```

Initial source actions:

- `listProjects`
- `listIssueTypes`
- `listStatuses`
- `listUsers`
- `listBoards`
- `listSprints`
- `listVersions`
- `listFields`
- `validateJql`
- `previewJql`
- `detectFieldMappings`

## Connection Setup

Jira Cloud v1 uses these fields:

```txt
Site URL: https://example.atlassian.net
Email
API token
```

Connection testing should call:

```txt
GET /rest/api/3/myself
```

On save, `jira.connection.js` should normalize the site URL and best-effort load lightweight metadata. The connection should persist enough source-owned setup state to make future builder sessions fast:

```js
{
  type: "jira",
  subType: "jira",
  host: "https://example.atlassian.net",
  schema: {
    jira: {
      accountId: "abc123",
      displayName: "Raz",
      emailAddress: "raz@example.com",
      siteUrl: "https://example.atlassian.net",
    },
    resources: ["issues", "boards", "sprints", "versions", "users", "fields"],
  },
  options: {
    jira: {
      siteUrl: "https://example.atlassian.net",
      fieldMappings: {
        storyPoints: "customfield_10016",
        severity: "customfield_10123",
        team: "customfield_10200",
      },
      defaults: {
        projectKeys: ["CHART"],
        boardId: 12,
      },
    },
  },
}
```

Field mapping should be part of connection setup or template setup. `detectFieldMappings` should scan `/rest/api/3/field`, choose likely matches by field name and schema, and let the user override. Story points is required for story-point charts, but not for count-based sprint charts.

## DataRequest Configuration

Every Jira DataRequest should store a Jira-owned `configuration` object. The protocol validates the configuration, applies variables, calls Jira Cloud, paginates, and returns normalized rows.

Example issues configuration:

```js
{
  source: "jira",
  resource: "issues",
  mode: "visual",
  jql: "project IN ({{projects}}) AND created >= {{start_date}} AND created <= {{end_date}}",
  fields: [
    "key",
    "summary",
    "status",
    "assignee",
    "priority",
    "issuetype",
    "created",
    "updated",
    "resolutiondate",
    "project",
  ],
  transform: {
    type: "grouped",
    metric: "count",
    groupBy: "status",
  },
  pagination: {
    startAt: 0,
    maxResults: 100,
    maxRecords: 5000,
  },
}
```

Supported v1 resources:

- `issues`
- `boards`
- `sprints`
- `sprint_issues`
- `versions`
- `fields`
- `users`

Supported v1 modes:

- `visual`
- `jql`
- `advanced`

## Runtime Behavior

Jira runtime output should be normalized by default. Raw Jira payloads are too nested and instance-specific for charting.

Normalized issue rows should look like:

```js
{
  key: "CHART-123",
  summary: "Add Jira dashboard template",
  projectKey: "CHART",
  issueType: "Story",
  status: "In Progress",
  statusCategory: "In Progress",
  assignee: "Raz",
  reporter: "Jane",
  priority: "High",
  createdAt: "2026-05-01T10:00:00.000Z",
  updatedAt: "2026-05-03T12:00:00.000Z",
  resolvedAt: null,
  storyPoints: 5,
  labels: ["dashboard", "jira"],
  fixVersions: ["v5.2.0"],
  epicKey: "CHART-100",
}
```

Aggregated outputs should already be chart-friendly:

```js
{ period: "2026-05-01", created: 8, resolved: 5, open: 42 }
{ status: "In Progress", issueCount: 14, storyPoints: 38 }
{ assignee: "Raz", issueCount: 7, storyPoints: 21 }
```

The protocol should support:

- `testConnection({ connection })`
- `testUnsavedConnection({ connection })`
- `prepareConnectionData({ connection })`
- `runDataRequest({ connection, dataRequest, getCache, filters, timezone, variables, auditContext })`
- `previewDataRequest({ connection, dataRequest, itemsLimit, items, offset, pagination, paginationField })`
- `getBuilderMetadata({ connection, dataRequest, options })`
- `getSchema({ connection, dataRequest })`
- `applyVariables({ dataRequest, variables })`
- `validateConfiguration(configuration, options)`
- source `actions`

Runtime should enforce caps for pagination and preview. Default limits should be conservative, such as 100 results per Jira page and 5000 max records per full request.

## Variables And Filters

Jira should support variables inside JQL and visual configuration:

- `{{projects}}`
- `{{assignees}}`
- `{{issue_types}}`
- `{{statuses}}`
- `{{start_date}}`
- `{{end_date}}`
- `{{board_id}}`
- `{{sprint_id}}`
- `{{fix_version}}`

Dashboard/date filters should merge into Jira config where possible, especially date range, project, assignee, issue type, sprint, and fix version. Unsupported filters should remain client-side instead of producing invalid JQL.

Important caveat:

Variable support at runtime and automatic variable creation are separate concerns. Variables are stored as `VariableBinding` rows and are usually created when a dataset or data request is created. `DatasetController.createWithDataRequests()` already accepts `variableBindings` for datasets and data requests, but implementation must verify that the built-in chart-template creation path preserves those bindings cleanly. If this path is not reliable enough, Jira template setup should create variable bindings after dataset creation.

## Frontend Layout

Add Jira under the source UI tree:

```txt
client/src/sources/jira/
  jira.source.js
  jira-connection-form.jsx
  jira-builder.jsx
  jira-template-setup.jsx
  components/
  assets/
```

Register frontend components in `client/src/sources/index.js` and source metadata in `client/src/sources/definitions.js`.

The source metadata should use:

```js
{
  id: "jira",
  type: "jira",
  subType: "jira",
  name: "Jira",
  category: "productivity",
}
```

The builder should have three modes:

- Visual
- JQL
- Advanced

The builder UI should follow the current Stripe Official builder layout and interaction model rather than introducing a new page pattern. Jira should use the same broad structure:

- A source-specific builder provider/context for shared builder state.
- A category or resource selection step similar to Stripe Official's category step.
- A configuration step for the selected Jira resource.
- An output/preview step for running the request and inspecting normalized rows.
- A summary sidebar for selected resource, filters, output shape, warnings, variables, and suggested charts.
- A collapsible advanced/config preview area for users who need to inspect the generated Jira configuration.

Jira-specific components should live under `client/src/sources/jira/components/` and mirror the Stripe Official component split where it helps keep files focused. The goal is visual and workflow consistency with Stripe Official while still using Jira language and controls.

Visual mode should cover non-technical Jira reporting:

- Resource: Issues, sprint issues, boards, sprints, versions
- Project
- Board
- Sprint
- Issue type
- Status and status category
- Assignee
- Priority
- Fix version
- Date field and date range
- Group by
- Metric: count, story points, average age, lead time

JQL mode should expose JQL, selected fields, and preview. It still stores a Jira configuration object, not a generic API request.

Advanced mode should expose resource and route-like choices only for supported Jira resources. It exists for debugging and edge cases, not as an arbitrary REST builder.

The right side of the builder should connect dataset configuration to chart creation by showing output shape, variables, warnings, and suggested chart types.

## Template Bundles

Ship separate plugin-owned JSON templates, similar to Stripe Official:

```txt
project-overview.json
sprint-health.json
bug-tracking.json
team-workload.json
```

Project overview:

- Open issues KPI
- Completed this period KPI
- Created vs resolved trend
- Issues by status
- Issues by assignee
- Recent completed work table

Sprint health:

- Sprint completion KPI
- Story points completed KPI
- Carryover issues table
- Work by assignee
- Sprint issue status breakdown

Bug tracking:

- Open bugs KPI
- Bugs by priority
- Oldest open bugs table
- Bug trend

Team workload:

- Open issues by assignee
- Work in progress by assignee
- Stale issues table

Template charts should use `layoutIntent` rather than fixed grid coordinates. Dataset outputs should be shaped so chart configs can bind directly to fields such as `root[].period`, `root[].issueCount`, `root[].storyPoints`, `root[].status`, and `root[].assignee`.

## AI Planner

Jira should use source-owned configuration mode. It must not expose `generateQuery`.

Implement:

- `getCapabilities({ connection })`
- `listResources({ connection })`
- `getSchema({ connection })`
- `getSampleData({ connection, resource, rowLimit })`
- `planDataset({ connection, question, overrides })`
- `validateConfiguration(configuration, { connection })`
- `previewConfiguration({ connection, configuration, rowLimit })`
- `listTemplates({ connection })`
- `recommendTemplates({ connection, question })`

The planner should support the same v1 resources as the builder:

- `issues`
- `boards`
- `sprints`
- `sprint_issues`
- `versions`
- `fields`
- `users`

Planner examples:

```txt
"Show open bugs by priority"
-> issues config, groupBy priority, metric count, bar chart

"Create a sprint health dashboard"
-> recommend sprint-health template, require board/sprint context if missing

"Which issues are stale?"
-> issues config with statusCategory != Done and updated before threshold, table chart

"Show completed story points for the active sprint"
-> sprint_issues config with active sprint and storyPoints metric, KPI chart
```

If a prompt needs a board, sprint, project, or field mapping that cannot be inferred, the planner should return `needs_more_context` or `needs_disambiguation`. It should not guess. Tool outputs must be compact and secret-free.

Dashboard creation caveat:

The current orchestrator has tools for creating datasets, charts, temporary charts, and moving charts to dashboards. It does not yet have a first-class generic tool for creating dashboards from registered source chart templates. Jira AI can expose `listTemplates` and `recommendTemplates`, but a prompt such as "create a sprint health dashboard" should either hand off to the template setup UI or use the future generic template/dashboard tool once it exists.

## Generic AI Dashboard Template Tool

Add a non-Jira-specific orchestration tool that creates dashboards/projects from registered source chart templates.

The tool should call the existing built-in chart-template creation path through `ChartTemplateController.createFromTemplate(...)`, with:

- source id
- template slug
- connection id
- selected dataset template ids
- selected chart template ids
- target dashboard options, either existing project id or new dashboard name

This tool should be available to any source with registered chart templates. Jira should be one consumer, not the owner. Stripe Official and future source AI layers should be able to adopt it later.

## Error Handling

Connection errors should distinguish:

- Invalid site URL.
- Invalid email or API token.
- Jira Cloud API permission problems.
- Agile API unavailable or board access denied.
- Missing field mappings for story-point charts.
- Invalid JQL.
- Unsupported resource or transform.
- Pagination cap reached.

Runtime errors should avoid leaking credentials and should include enough source context to debug the failed operation.

## Testing

Backend tests:

- `server/tests/unit/sourceRegistry.test.js` resolves Jira by `id`, `type`, and persisted connection shape.
- `server/tests/unit/sourcePluginStructure.test.js` validates Jira plugin metadata and capabilities.
- `server/tests/integration/connectionRoute.security.test.js` verifies source action authorization and rejects unlisted actions.
- Jira protocol unit tests cover configuration validation, JQL building, variable application, pagination, normalization, field mappings, and transform output.
- Jira template tests validate each template JSON file and chart/dataset dependency shape.
- Template creation tests cover variable binding behavior if Jira templates rely on `dataRequest.variableBindings`.
- `server/tests/unit/sourceAiHarness.test.js` covers Jira planner statuses, DataRequest shapes, chart specs, compact output, invalid fields, and template recommendations.

Frontend tests, where current setup supports them:

- Connection form validation.
- Builder mode switching.
- Visual config to DataRequest shape.
- JQL preview wiring.
- Field mapping override UI.
- Template setup requirements for project, board, sprint, and story points.

Manual verification:

- Create Jira Cloud connection.
- Test metadata actions.
- Detect and override story points field mapping.
- Preview issue and sprint issue datasets.
- Create each template bundle.
- Run source AI planning for issues and sprint summary requests.
- Verify chart rendering for KPI, trend, bar, doughnut, and table charts.

## Implementation Notes

- Follow `source-plugin-guide.md` for all source runtime, frontend source UI, template, and AI changes.
- Keep Jira-specific behavior inside `server/sources/plugins/jira/` and `client/src/sources/jira/`.
- Prefer registry and capability checks over `connection.type` branches.
- Do not add source-specific controller branches or helper routes.
- Keep Jira resource definitions compact and bounded. Do not embed large Jira API documentation in orchestrator prompts.
- Use mocked Jira responses in tests. Do not depend on live Jira Cloud.
- Keep all code JavaScript with double quotes.
