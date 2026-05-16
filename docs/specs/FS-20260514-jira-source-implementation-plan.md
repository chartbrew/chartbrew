# Jira Source Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Jira Cloud as a custom Chartbrew source with connection setup, Jira builder, normalized runtime, templates, and source-owned AI planning.

**Architecture:** Jira is a custom source with `id`, `type`, and `subType` all set to `"jira"`. Backend runtime lives in `server/sources/plugins/jira/`; frontend UI lives in `client/src/sources/jira/`; templates are JSON files loaded through the existing source template system. Jira uses source actions for metadata and source-owned AI tools for planning, while dashboard creation from templates is handled by a generic orchestrator tool.

**Tech Stack:** Node.js, Express, Sequelize, request-promise, React, Redux Toolkit, HeroUI, Vite, existing Chartbrew source plugin registry.

---

## File Structure

Create:

- `server/sources/plugins/jira/jira.plugin.js` - Jira source metadata, capabilities, template registration, backend hooks.
- `server/sources/plugins/jira/jira.connection.js` - Jira Cloud auth, URL normalization, safe request helpers, metadata actions.
- `server/sources/plugins/jira/jira.resources.js` - Supported resources, fields, transforms, template constants, field mapping helpers.
- `server/sources/plugins/jira/jira.protocol.js` - DataRequest defaults, variable application, validation, runtime execution, normalization, caching/audit.
- `server/sources/plugins/jira/ai/jira.ai.js` - Source-owned planner, schema, preview, template recommendation.
- `server/sources/plugins/jira/templates/project-overview.json` - Project overview starter bundle.
- `server/sources/plugins/jira/templates/sprint-health.json` - Sprint health starter bundle.
- `server/sources/plugins/jira/templates/bug-tracking.json` - Bug tracking starter bundle.
- `server/sources/plugins/jira/templates/team-workload.json` - Team workload starter bundle.
- `server/tests/unit/jiraProtocol.test.js` - Protocol validation, JQL building, normalization, pagination, and variable tests.
- `server/tests/unit/jiraTemplates.test.js` - Template validation and variable binding coverage.
- `client/src/sources/jira/jira.source.js` - Frontend source metadata and defaults.
- `client/src/sources/jira/jira-connection-form.jsx` - Jira connection form.
- `client/src/sources/jira/jira-builder.jsx` - Jira dataset builder container following Stripe Official layout.
- `client/src/sources/jira/jira-template-setup.jsx` - Jira template bundle setup.
- `client/src/sources/jira/jira-builder.constants.jsx` - UI resource and option constants.
- `client/src/sources/jira/jira-builder.utils.js` - Builder config normalization and preview utilities.
- `client/src/sources/jira/assets/jira.svg` - Jira logo asset.
- `client/src/sources/jira/components/jira-builder-context.jsx` - Builder state provider.
- `client/src/sources/jira/components/jira-resource-step.jsx` - Resource/category selection.
- `client/src/sources/jira/components/jira-config-step.jsx` - Visual/JQL/advanced configuration.
- `client/src/sources/jira/components/jira-preview-step.jsx` - Preview and normalized output table.
- `client/src/sources/jira/components/jira-summary-sidebar.jsx` - Summary, warnings, variables, suggested charts.
- `server/modules/ai/orchestrator/tools/createDashboardFromTemplate.js` - Generic AI tool for registered chart templates.

Modify:

- `server/sources/index.js` - Register Jira plugin.
- `client/src/sources/definitions.js` - Register Jira source metadata.
- `client/src/sources/index.js` - Register Jira connection form, builder, and template setup.
- `server/modules/ai/orchestrator/tools/index.js` - Export generic dashboard-template tool.
- `server/modules/ai/orchestrator/orchestrator.js` - Add generic dashboard-template tool schema and dispatch.
- `server/tests/unit/sourceRegistry.test.js` - Assert Jira resolution.
- `server/tests/unit/sourcePluginStructure.test.js` - Assert Jira plugin shape.
- `server/tests/integration/connectionRoute.security.test.js` - Assert Jira source-action security.
- `server/tests/unit/sourceAiHarness.test.js` - Add Jira source-owned AI coverage and dashboard-template tool coverage.

---

## Task 1: Backend Plugin Skeleton And Registry

**Files:**
- Create: `server/sources/plugins/jira/jira.plugin.js`
- Create: `server/sources/plugins/jira/jira.protocol.js`
- Create: `server/sources/plugins/jira/jira.connection.js`
- Create: `server/sources/plugins/jira/jira.resources.js`
- Modify: `server/sources/index.js`
- Modify: `server/tests/unit/sourceRegistry.test.js`
- Modify: `server/tests/unit/sourcePluginStructure.test.js`

- [ ] **Step 1: Write failing registry tests**

Add assertions to `server/tests/unit/sourceRegistry.test.js` that load the source registry and verify:

```js
const jira = getSourceById("jira");
expect(jira.id).toBe("jira");
expect(jira.type).toBe("jira");
expect(jira.subType).toBe("jira");
expect(getSourceForConnection({ type: "jira", subType: "jira" }).id).toBe("jira");
```

Add assertions to `server/tests/unit/sourcePluginStructure.test.js` that Jira exposes:

```js
expect(jira.capabilities.connection.supportsTest).toBe(true);
expect(jira.capabilities.connection.authModes).toContain("api_token");
expect(jira.capabilities.data.supportsVariables).toBe(true);
expect(jira.capabilities.templates.charts).toBe(true);
expect(jira.capabilities.ai.hasTools).toBe(true);
expect(jira.backend.runDataRequest).toEqual(expect.any(Function));
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm run test:run -- tests/unit/sourceRegistry.test.js tests/unit/sourcePluginStructure.test.js
```

Expected: FAIL because `./plugins/jira/jira.plugin` is not registered.

- [ ] **Step 3: Add minimal Jira resources**

Create `server/sources/plugins/jira/jira.resources.js`:

```js
const DEFAULT_FIELDS = [
  "key",
  "summary",
  "status",
  "assignee",
  "reporter",
  "priority",
  "issuetype",
  "created",
  "updated",
  "resolutiondate",
  "project",
  "parent",
  "fixVersions",
  "labels",
];

const JIRA_RESOURCES = {
  issues: { label: "Issues", endpoint: "/rest/api/3/search", fields: DEFAULT_FIELDS },
  boards: { label: "Boards", endpoint: "/rest/agile/1.0/board" },
  sprints: { label: "Sprints", endpoint: "/rest/agile/1.0/board/{boardId}/sprint" },
  sprint_issues: { label: "Sprint issues", endpoint: "/rest/agile/1.0/sprint/{sprintId}/issue", fields: DEFAULT_FIELDS },
  versions: { label: "Versions", endpoint: "/rest/api/3/project/{projectIdOrKey}/versions" },
  fields: { label: "Fields", endpoint: "/rest/api/3/field" },
  users: { label: "Users", endpoint: "/rest/api/3/user/search" },
};

const FIELD_MAPPING_NAMES = {
  storyPoints: ["story points", "story point estimate", "estimate"],
  severity: ["severity"],
  team: ["team"],
};

module.exports = {
  DEFAULT_FIELDS,
  FIELD_MAPPING_NAMES,
  JIRA_RESOURCES,
};
```

- [ ] **Step 4: Add minimal protocol**

Create `server/sources/plugins/jira/jira.protocol.js`:

```js
const { JIRA_RESOURCES, DEFAULT_FIELDS } = require("./jira.resources");

const DEFAULT_CONFIGURATION = {
  source: "jira",
  resource: "issues",
  mode: "visual",
  jql: "created >= {{start_date}} AND created <= {{end_date}} ORDER BY updated DESC",
  fields: DEFAULT_FIELDS,
  transform: { type: "raw" },
  pagination: { startAt: 0, maxResults: 100, maxRecords: 5000 },
};

function getDefaultDataRequest() {
  return {
    method: "GET",
    route: null,
    headers: {},
    body: null,
    conditions: null,
    configuration: { ...DEFAULT_CONFIGURATION },
    query: null,
    pagination: true,
    items: "issues",
    itemsLimit: 5000,
    offset: "startAt",
    paginationField: null,
    template: "jira",
    useGlobalHeaders: true,
  };
}

function validateConfiguration(configuration = {}) {
  const config = {
    ...DEFAULT_CONFIGURATION,
    ...configuration,
    pagination: {
      ...DEFAULT_CONFIGURATION.pagination,
      ...(configuration.pagination || {}),
    },
  };
  const errors = [];

  if (config.source !== "jira") errors.push("configuration.source must be jira");
  if (!JIRA_RESOURCES[config.resource]) errors.push(`Unsupported Jira resource: ${config.resource || "missing"}`);
  if (!["visual", "jql", "advanced"].includes(config.mode)) errors.push("mode must be visual, jql, or advanced");
  if (config.resource === "issues" && !String(config.jql || "").trim()) errors.push("jql is required for issue searches");
  if (Number(config.pagination.maxResults) > 100) errors.push("pagination.maxResults cannot exceed 100");
  if (Number(config.pagination.maxRecords) > 10000) errors.push("pagination.maxRecords cannot exceed 10000");

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
    configuration: config,
  };
}

function assertValidConfiguration(configuration) {
  const validation = validateConfiguration(configuration);
  if (!validation.valid) throw new Error(validation.errors.join(" "));
  return validation.configuration;
}

function getBuilderMetadata() {
  return Promise.resolve({
    source: "jira",
    resources: JIRA_RESOURCES,
    defaults: DEFAULT_CONFIGURATION,
  });
}

async function testConnection({ connection }) {
  const jiraConnection = require("./jira.connection"); // eslint-disable-line global-require
  const myself = await jiraConnection.getMyself(connection);
  return { success: true, metadata: myself };
}

function testUnsavedConnection({ connection }) {
  return testConnection({ connection });
}

async function runDataRequest() {
  throw new Error("Jira runtime is not implemented yet");
}

module.exports = {
  assertValidConfiguration,
  getBuilderMetadata,
  getDefaultDataRequest,
  runDataRequest,
  testConnection,
  testUnsavedConnection,
  validateConfiguration,
};
```

- [ ] **Step 5: Add minimal connection helper**

Create `server/sources/plugins/jira/jira.connection.js`:

```js
const request = require("request-promise");

function normalizeSiteUrl(siteUrl = "") {
  const trimmed = String(siteUrl).trim().replace(/\/+$/, "");
  if (!/^https:\/\/[^/]+\.atlassian\.net$/i.test(trimmed)) {
    throw new Error("Enter a Jira Cloud site URL like https://example.atlassian.net");
  }
  return trimmed;
}

function toPlainObject(value) {
  if (!value) return {};
  if (typeof value.toJSON === "function") return value.toJSON();
  return { ...value };
}

function getCredentials(connection) {
  const plain = toPlainObject(connection);
  const siteUrl = normalizeSiteUrl(plain.host || plain.options?.jira?.siteUrl || plain.authentication?.siteUrl);
  const email = plain.authentication?.email || plain.authentication?.user || plain.username || "";
  const apiToken = plain.authentication?.apiToken || plain.authentication?.token || plain.password || "";
  if (!email) throw new Error("Enter your Jira account email");
  if (!apiToken) throw new Error("Enter your Jira API token");
  return { siteUrl, email, apiToken };
}

function jiraRequest(connection, route, options = {}) {
  const { siteUrl, email, apiToken } = getCredentials(connection);
  return request({
    method: options.method || "GET",
    uri: `${siteUrl}${route}`,
    auth: { user: email, pass: apiToken },
    qs: options.qs || undefined,
    body: options.body || undefined,
    json: true,
    resolveWithFullResponse: false,
  });
}

function getMyself(connection) {
  return jiraRequest(connection, "/rest/api/3/myself");
}

module.exports = {
  getCredentials,
  getMyself,
  jiraRequest,
  normalizeSiteUrl,
};
```

- [ ] **Step 6: Add plugin and registry entry**

Create `server/sources/plugins/jira/jira.plugin.js`:

```js
const path = require("path");
const jiraProtocol = require("./jira.protocol");

module.exports = {
  id: "jira",
  type: "jira",
  subType: "jira",
  name: "Jira",
  category: "productivity",
  description: "Connect to Jira Cloud projects, issues, boards, and sprints.",
  capabilities: {
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
  },
  backend: jiraProtocol,
  templates: {
    directory: path.join(__dirname, "templates"),
    chartTemplates: ["project-overview", "sprint-health", "bug-tracking", "team-workload"],
    defaults: {
      dataRequest: jiraProtocol.getDefaultDataRequest(),
    },
  },
};
```

Modify `server/sources/index.js`:

```js
const jira = require("./plugins/jira/jira.plugin");
```

Add `jira` to the `sources` array near the other custom sources.

- [ ] **Step 7: Run registry tests**

Run:

```bash
npm run test:run -- tests/unit/sourceRegistry.test.js tests/unit/sourcePluginStructure.test.js
```

Expected: PASS for Jira registry and structure assertions.

- [ ] **Step 8: Commit backend skeleton**

```bash
git add server/sources/index.js server/sources/plugins/jira server/tests/unit/sourceRegistry.test.js server/tests/unit/sourcePluginStructure.test.js
git commit -m "feat: add jira source plugin skeleton"
```

---

## Task 2: Jira Connection Actions And Metadata

**Files:**
- Modify: `server/sources/plugins/jira/jira.connection.js`
- Modify: `server/sources/plugins/jira/jira.protocol.js`
- Test: `server/tests/unit/jiraProtocol.test.js`
- Modify: `server/tests/integration/connectionRoute.security.test.js`

- [ ] **Step 1: Write action tests**

Create `server/tests/unit/jiraProtocol.test.js` with tests that stub `jira.connection.jiraRequest` and verify:

```js
expect(await actions.listProjects({ connection })).toEqual([{ id: "10000", key: "CHART", name: "Chartbrew" }]);
expect(await actions.listBoards({ connection, params: { projectKeyOrId: "CHART" } })).toEqual([{ id: 12, name: "CHART board", type: "scrum" }]);
expect(await actions.detectFieldMappings({ connection })).toEqual({
  fieldMappings: { storyPoints: "customfield_10016" },
  candidates: expect.any(Object),
});
```

Add integration assertions that an unknown Jira action returns `400` and allowed actions require a team-scoped connection, matching existing source action security patterns.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test:run -- tests/unit/jiraProtocol.test.js tests/integration/connectionRoute.security.test.js
```

Expected: FAIL because Jira actions are not implemented.

- [ ] **Step 3: Add metadata helpers**

Add to `jira.connection.js`:

```js
function listProjects(connection) {
  return jiraRequest(connection, "/rest/api/3/project/search", { qs: { maxResults: 50 } })
    .then((response) => (response.values || []).map((project) => ({
      id: project.id,
      key: project.key,
      name: project.name,
      projectTypeKey: project.projectTypeKey,
    })));
}

function listBoards(connection, params = {}) {
  return jiraRequest(connection, "/rest/agile/1.0/board", {
    qs: {
      maxResults: 50,
      projectKeyOrId: params.projectKeyOrId || undefined,
      type: params.type || undefined,
    },
  }).then((response) => (response.values || []).map((board) => ({
    id: board.id,
    name: board.name,
    type: board.type,
  })));
}

function listFields(connection) {
  return jiraRequest(connection, "/rest/api/3/field")
    .then((fields) => (fields || []).map((field) => ({
      id: field.id,
      key: field.key,
      name: field.name,
      custom: field.custom,
      schema: field.schema || {},
    })));
}
```

- [ ] **Step 4: Add field mapping detection**

Add to `jira.connection.js`:

```js
const { FIELD_MAPPING_NAMES } = require("./jira.resources");

function normalizeFieldName(name = "") {
  return String(name).trim().toLowerCase();
}

function detectFieldMappingsFromFields(fields = []) {
  const candidates = {};
  const fieldMappings = {};

  Object.entries(FIELD_MAPPING_NAMES).forEach(([semanticName, names]) => {
    const matches = fields.filter((field) => {
      const fieldName = normalizeFieldName(field.name);
      return names.some((name) => fieldName.includes(name));
    });
    candidates[semanticName] = matches.map((field) => ({
      id: field.id,
      name: field.name,
      schema: field.schema,
    }));
    if (matches[0]) fieldMappings[semanticName] = matches[0].id;
  });

  return { fieldMappings, candidates };
}

async function detectFieldMappings(connection) {
  const fields = await listFields(connection);
  return detectFieldMappingsFromFields(fields);
}
```

Export the new helpers.

- [ ] **Step 5: Add source actions**

Add to `jira.protocol.js`:

```js
const jiraConnection = require("./jira.connection");

const actions = {
  listProjects({ connection }) {
    return jiraConnection.listProjects(connection);
  },
  listBoards({ connection, params }) {
    return jiraConnection.listBoards(connection, params);
  },
  listFields({ connection }) {
    return jiraConnection.listFields(connection);
  },
  detectFieldMappings({ connection }) {
    return jiraConnection.detectFieldMappings(connection);
  },
};

module.exports = {
  actions,
  assertValidConfiguration,
  getBuilderMetadata,
  getDefaultDataRequest,
  runDataRequest,
  testConnection,
  testUnsavedConnection,
  validateConfiguration,
};
```

- [ ] **Step 6: Add remaining actions**

Implement `listIssueTypes`, `listStatuses`, `listUsers`, `listSprints`, `listVersions`, `validateJql`, and `previewJql` using these Jira Cloud routes:

```txt
GET /rest/api/3/issuetype
GET /rest/api/3/status
GET /rest/api/3/user/search?query=
GET /rest/agile/1.0/board/{boardId}/sprint
GET /rest/api/3/project/{projectIdOrKey}/versions
POST /rest/api/3/jql/parse?validation=strict
GET /rest/api/3/search
```

Normalize every action response to compact arrays of identifiers and labels.

- [ ] **Step 7: Run action tests**

Run:

```bash
npm run test:run -- tests/unit/jiraProtocol.test.js tests/integration/connectionRoute.security.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit connection actions**

```bash
git add server/sources/plugins/jira server/tests/unit/jiraProtocol.test.js server/tests/integration/connectionRoute.security.test.js
git commit -m "feat: add jira source actions"
```

---

## Task 3: Jira Runtime, Variables, Normalization, And Caching

**Files:**
- Modify: `server/sources/plugins/jira/jira.protocol.js`
- Modify: `server/sources/plugins/jira/jira.resources.js`
- Test: `server/tests/unit/jiraProtocol.test.js`

- [ ] **Step 1: Add failing runtime tests**

Add tests for:

```js
validateConfiguration({ source: "jira", resource: "unknown" }).valid === false
applyVariables replaces {{projects}}, {{start_date}}, and {{end_date}} in configuration.jql
normalizeIssue maps fields.status.statusCategory.name to statusCategory
aggregateRows groups by status and sums storyPoints
runDataRequest caches responseData.data
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test:run -- tests/unit/jiraProtocol.test.js
```

Expected: FAIL on missing runtime helpers.

- [ ] **Step 3: Implement variable application**

Use `processVariablesInString` from `server/sources/shared/variables/stringVariables.js` and recursively process Jira configuration values:

```js
function processConfigValue(value, dataRequest, variables) {
  if (typeof value === "string") {
    return processVariablesInString({ value, dataRequest, variables });
  }
  if (Array.isArray(value)) return value.map((item) => processConfigValue(item, dataRequest, variables));
  if (value && typeof value === "object") {
    return Object.keys(value).reduce((next, key) => ({
      ...next,
      [key]: processConfigValue(value[key], dataRequest, variables),
    }), {});
  }
  return value;
}

function applyVariables({ dataRequest, variables }) {
  const processedConfiguration = processConfigValue(dataRequest.configuration || {}, dataRequest, variables);
  return {
    dataRequest,
    processedDataRequest: {
      ...dataRequest,
      configuration: processedConfiguration,
      Connection: dataRequest.Connection,
      VariableBindings: dataRequest.VariableBindings,
    },
  };
}
```

- [ ] **Step 4: Implement normalization**

Add:

```js
function normalizeIssue(issue, fieldMappings = {}) {
  const fields = issue.fields || {};
  return {
    key: issue.key,
    summary: fields.summary || "",
    projectKey: fields.project?.key || null,
    issueType: fields.issuetype?.name || null,
    status: fields.status?.name || null,
    statusCategory: fields.status?.statusCategory?.name || null,
    assignee: fields.assignee?.displayName || null,
    reporter: fields.reporter?.displayName || null,
    priority: fields.priority?.name || null,
    createdAt: fields.created || null,
    updatedAt: fields.updated || null,
    resolvedAt: fields.resolutiondate || null,
    storyPoints: Number(fields[fieldMappings.storyPoints] || 0),
    severity: fieldMappings.severity ? fields[fieldMappings.severity]?.value || fields[fieldMappings.severity] || null : null,
    team: fieldMappings.team ? fields[fieldMappings.team]?.value || fields[fieldMappings.team] || null : null,
    labels: fields.labels || [],
    fixVersions: (fields.fixVersions || []).map((version) => version.name),
    epicKey: fields.parent?.key || fields.customfield_epic || null,
  };
}
```

- [ ] **Step 5: Implement transforms**

Support transform types:

```txt
raw
grouped
created_resolved_trend
sprint_summary
stale_table
```

The grouped transform should return:

```js
{ [groupBy]: label, issueCount, storyPoints }
```

The trend transform should return:

```js
{ period, created, resolved, open }
```

- [ ] **Step 6: Implement Jira fetch and pagination**

For issue searches, call:

```txt
GET /rest/api/3/search
```

with `jql`, `fields`, `startAt`, and `maxResults`.

For sprint issues, call:

```txt
GET /rest/agile/1.0/sprint/{sprintId}/issue
```

with the same pagination pattern. Stop when Jira returns fewer rows than `maxResults`, when `isLast` is true, or when `maxRecords` is reached.

- [ ] **Step 7: Implement runDataRequest**

Follow the Stripe Official runtime pattern:

```js
if (getCache) {
  const drCache = await checkAndGetCache(connection.id, dataRequest);
  if (drCache) return drCache;
}
const rows = await fetchJiraRows(savedConnection, config);
const transformedRows = transformRows(rows, config, savedConnection.options?.jira?.fieldMappings || {});
const dataToCache = { dataRequest, responseData: { data: transformedRows }, connection_id: savedConnection.id };
await drCacheController.create(dataRequest.id, dataToCache);
return dataToCache;
```

Include connector audit success/failure with `serializeResponsePreview`.

- [ ] **Step 8: Run runtime tests**

Run:

```bash
npm run test:run -- tests/unit/jiraProtocol.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit runtime**

```bash
git add server/sources/plugins/jira server/tests/unit/jiraProtocol.test.js
git commit -m "feat: add jira runtime"
```

---

## Task 4: Jira Templates

**Files:**
- Create: `server/sources/plugins/jira/templates/project-overview.json`
- Create: `server/sources/plugins/jira/templates/sprint-health.json`
- Create: `server/sources/plugins/jira/templates/bug-tracking.json`
- Create: `server/sources/plugins/jira/templates/team-workload.json`
- Create: `server/tests/unit/jiraTemplates.test.js`

- [ ] **Step 1: Write template validation tests**

Use `loadTemplate("jira", slug)` and assert each Jira template loads, includes datasets, includes charts, and every chart references existing datasets.

Add a focused test that a template dataset can include:

```js
variableBindings: [{
  name: "start_date",
  type: "date",
  default_value: "last_30_days",
  required: false,
}]
```

and that `ChartTemplateController.createFromTemplate(...)` passes this through to `DatasetController.createWithDataRequests(...)`.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test:run -- tests/unit/jiraTemplates.test.js
```

Expected: FAIL because template files do not exist.

- [ ] **Step 3: Add project overview template**

Create `project-overview.json` with:

```json
{
  "id": "jira-project-overview",
  "slug": "project-overview",
  "version": 1,
  "source": "jira",
  "name": "Jira Project Overview",
  "description": "Project-level Jira KPIs, issue trends, status breakdowns, and recent completed work.",
  "requiredConnection": { "type": "jira", "subType": "jira" },
  "datasets": [
    {
      "id": "issues_created_resolved",
      "name": "Jira issues created vs resolved",
      "fieldsSchema": {
        "root[].period": "date",
        "root[].created": "number",
        "root[].resolved": "number",
        "root[].open": "number"
      },
      "dataRequest": {
        "configuration": {
          "source": "jira",
          "resource": "issues",
          "mode": "visual",
          "jql": "project IN ({{projects}}) AND created >= {{start_date}} AND created <= {{end_date}} ORDER BY created ASC",
          "transform": { "type": "created_resolved_trend", "interval": "day" },
          "pagination": { "startAt": 0, "maxResults": 100, "maxRecords": 5000 }
        },
        "variableBindings": [
          { "name": "projects", "type": "string", "default_value": "", "required": true },
          { "name": "start_date", "type": "date", "default_value": "last_30_days", "required": false },
          { "name": "end_date", "type": "date", "default_value": "today", "required": false }
        ]
      }
    }
  ],
  "charts": [
    {
      "id": "created-vs-resolved",
      "name": "Issues created vs resolved",
      "type": "line",
      "requiredDatasetIds": ["issues_created_resolved"],
      "layoutIntent": { "kind": "trend", "priority": 10 },
      "cdcs": [
        { "datasetTemplateId": "issues_created_resolved", "xAxis": "root[].period", "yAxis": "root[].created", "legend": "Created" },
        { "datasetTemplateId": "issues_created_resolved", "xAxis": "root[].period", "yAxis": "root[].resolved", "legend": "Resolved" }
      ]
    }
  ]
}
```

Then expand the file with the remaining project overview datasets/charts from the spec.

- [ ] **Step 4: Add remaining templates**

Create the other three templates using the same structure:

- `sprint-health.json`: sprint completion KPI, story points completed KPI, carryover issues table, work by assignee, sprint status breakdown.
- `bug-tracking.json`: open bugs KPI, bugs by priority, oldest open bugs table, bug trend.
- `team-workload.json`: open issues by assignee, WIP by assignee, stale issues table.

- [ ] **Step 5: Run template tests**

Run:

```bash
npm run test:run -- tests/unit/jiraTemplates.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit templates**

```bash
git add server/sources/plugins/jira/templates server/tests/unit/jiraTemplates.test.js
git commit -m "feat: add jira chart templates"
```

---

## Task 5: Frontend Source Registration And Connection Form

**Files:**
- Create: `client/src/sources/jira/jira.source.js`
- Create: `client/src/sources/jira/jira-connection-form.jsx`
- Create: `client/src/sources/jira/assets/jira.svg`
- Modify: `client/src/sources/definitions.js`
- Modify: `client/src/sources/index.js`

- [ ] **Step 1: Add frontend source metadata**

Create `jira.source.js`:

```js
import jiraLogo from "./assets/jira.svg";

const DEFAULT_CONFIGURATION = {
  source: "jira",
  resource: "issues",
  mode: "visual",
  jql: "created >= {{start_date}} AND created <= {{end_date}} ORDER BY updated DESC",
  fields: ["key", "summary", "status", "assignee", "priority", "issuetype", "created", "updated", "resolutiondate", "project"],
  transform: { type: "raw" },
  pagination: { startAt: 0, maxResults: 100, maxRecords: 5000 },
};

const jiraSource = {
  id: "jira",
  type: "jira",
  subType: "jira",
  name: "Jira",
  category: "productivity",
  capabilities: {
    ai: { canGenerateQueries: false, hasSourceInstructions: true, hasTools: true, canGenerateDatasets: true },
    templates: { charts: true, datasets: true },
    nextSteps: { chartTemplates: true, datasetTemplates: true },
  },
  assets: {
    lightLogo: jiraLogo,
    darkLogo: jiraLogo,
  },
  defaults: {
    dataRequest: {
      method: "GET",
      pagination: true,
      items: "issues",
      itemsLimit: 5000,
      offset: "startAt",
      paginationField: null,
      template: "jira",
      useGlobalHeaders: true,
      configuration: DEFAULT_CONFIGURATION,
    },
  },
  templates: {
    chartTemplates: ["project-overview", "sprint-health", "bug-tracking", "team-workload"],
  },
};

export { DEFAULT_CONFIGURATION };
export default jiraSource;
```

- [ ] **Step 2: Register source**

Modify `client/src/sources/definitions.js` to import `jiraSource` and include it in `SOURCE_DEFINITIONS`.

Modify `client/src/sources/index.js` to import Jira frontend components and register:

```js
jira: {
  ConnectionForm: JiraConnectionForm,
  DataRequestBuilder: JiraBuilder,
  ChartTemplateSetup: JiraTemplateSetup,
}
```

- [ ] **Step 3: Implement connection form**

Create `jira-connection-form.jsx` using existing source form patterns. It should collect:

```txt
name
host
authentication.email
authentication.apiToken
```

The submitted connection data should include:

```js
{
  type: "jira",
  subType: "jira",
  host,
  authentication: {
    type: "api_token",
    email,
    apiToken,
  },
}
```

- [ ] **Step 4: Run frontend build check**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit frontend registration**

```bash
git add client/src/sources/definitions.js client/src/sources/index.js client/src/sources/jira
git commit -m "feat: add jira frontend source"
```

---

## Task 6: Jira Builder UI

**Files:**
- Create: `client/src/sources/jira/jira-builder.jsx`
- Create: `client/src/sources/jira/jira-builder.constants.jsx`
- Create: `client/src/sources/jira/jira-builder.utils.js`
- Create: `client/src/sources/jira/components/jira-builder-context.jsx`
- Create: `client/src/sources/jira/components/jira-resource-step.jsx`
- Create: `client/src/sources/jira/components/jira-config-step.jsx`
- Create: `client/src/sources/jira/components/jira-preview-step.jsx`
- Create: `client/src/sources/jira/components/jira-summary-sidebar.jsx`

- [ ] **Step 1: Mirror Stripe Official builder structure**

Use `client/src/sources/stripeOfficial/stripeOfficial-builder.jsx` as the layout reference. Jira builder should have:

```txt
resource/category step
configuration step
preview step
summary sidebar
advanced/config preview toggle
variable drawer where supported
DataTransform support
```

- [ ] **Step 2: Add constants**

Create resource options:

```js
export const RESOURCE_OPTIONS = [
  { id: "issues", label: "Issues" },
  { id: "sprint_issues", label: "Sprint issues" },
  { id: "boards", label: "Boards" },
  { id: "sprints", label: "Sprints" },
  { id: "versions", label: "Versions" },
];

export const GROUP_BY_OPTIONS = [
  { value: "status", label: "Status" },
  { value: "statusCategory", label: "Status category" },
  { value: "assignee", label: "Assignee" },
  { value: "priority", label: "Priority" },
  { value: "issueType", label: "Issue type" },
  { value: "projectKey", label: "Project" },
];

export const METRIC_OPTIONS = [
  { value: "count", label: "Count issues" },
  { value: "storyPoints", label: "Sum story points" },
  { value: "averageAge", label: "Average age" },
  { value: "leadTime", label: "Lead time" },
];
```

- [ ] **Step 3: Add config utilities**

Implement:

```js
import { DEFAULT_CONFIGURATION } from "./jira.source";

export function mergeConfiguration(dataRequest) {
  return {
    ...DEFAULT_CONFIGURATION,
    ...(dataRequest?.configuration || {}),
    transform: {
      ...DEFAULT_CONFIGURATION.transform,
      ...(dataRequest?.configuration?.transform || {}),
    },
    pagination: {
      ...DEFAULT_CONFIGURATION.pagination,
      ...(dataRequest?.configuration?.pagination || {}),
    },
  };
}

function quoteJqlValue(value) {
  if (value === undefined || value === null || value === "") return null;
  return `"${String(value).replace(/"/g, "\\\"")}"`;
}

export function buildJqlFromVisualConfig(configuration) {
  const clauses = [];
  if (configuration.projects) clauses.push(`project IN (${configuration.projects})`);
  if (configuration.issueType) clauses.push(`issuetype = ${quoteJqlValue(configuration.issueType)}`);
  if (configuration.statusCategory) clauses.push(`statusCategory = ${quoteJqlValue(configuration.statusCategory)}`);
  if (configuration.assignee) clauses.push(`assignee = ${quoteJqlValue(configuration.assignee)}`);
  if (configuration.priority) clauses.push(`priority = ${quoteJqlValue(configuration.priority)}`);
  if (configuration.fixVersion) clauses.push(`fixVersion = ${quoteJqlValue(configuration.fixVersion)}`);
  if (configuration.dateRange?.start) clauses.push(`${configuration.dateRange.field || "created"} >= ${configuration.dateRange.start}`);
  if (configuration.dateRange?.end) clauses.push(`${configuration.dateRange.field || "created"} <= ${configuration.dateRange.end}`);
  return `${clauses.filter(Boolean).join(" AND ") || "ORDER BY updated DESC"}`;
}

export function getPreviewRows(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.response?.data)) return payload.response.data;
  if (Array.isArray(payload?.response?.dataRequest?.responseData?.data)) return payload.response.dataRequest.responseData.data;
  return [];
}

export function getPreviewColumns(payload) {
  const firstRow = getPreviewRows(payload)[0];
  return firstRow ? Object.keys(firstRow) : [];
}

export function getSuggestedCharts(configuration) {
  if (configuration.transform?.type === "grouped") {
    return ["bar", "doughnut", "table"];
  }
  if (configuration.transform?.type === "created_resolved_trend") {
    return ["line", "bar"];
  }
  if (configuration.transform?.type === "sprint_summary") {
    return ["kpi", "bar", "table"];
  }
  return ["table"];
}
```

- [ ] **Step 4: Implement source actions in UI**

Use `runSourceAction` for:

```txt
listProjects
listBoards
listSprints
listFields
detectFieldMappings
validateJql
previewJql
```

Cache action results inside builder state to avoid repeated metadata calls.

- [ ] **Step 5: Implement preview and save flow**

Follow the Stripe Official pattern:

```txt
on configuration change -> update DataRequest with template: "jira"
Preview -> save request if needed -> dispatch runDataRequest
Save -> onSave(jiraRequest)
Delete -> onDelete
Transform -> DataTransform save
```

- [ ] **Step 6: Run client build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit builder**

```bash
git add client/src/sources/jira
git commit -m "feat: add jira dataset builder"
```

---

## Task 7: Jira Template Setup UI

**Files:**
- Create: `client/src/sources/jira/jira-template-setup.jsx`
- Modify: `client/src/sources/jira/jira-builder.utils.js`

- [ ] **Step 1: Implement bundle picker**

Use Stripe Official template setup as the reference. Jira setup should let users choose:

```txt
Project overview
Sprint health
Bug tracking
Team workload
```

It should require a connection and target dashboard options.

- [ ] **Step 2: Add Jira setup fields**

Before creating templates, collect or infer:

```txt
project keys
board id, when sprint-health is selected
sprint id or active sprint, when sprint-health is selected
story points field mapping, when story-point charts are selected
```

Use source actions to load projects, boards, sprints, and field mappings.

- [ ] **Step 3: Call chart template APIs**

Use the existing built-in chart-template client flow used by Stripe Official. Send:

```js
{
  connection_id,
  dataset_template_ids,
  chart_template_ids,
  dashboard: { type: "existing", project_id }
}
```

or:

```js
{
  connection_id,
  dashboard: { type: "new", name: "Jira Project Overview" }
}
```

- [ ] **Step 4: Run client build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit template setup**

```bash
git add client/src/sources/jira/jira-template-setup.jsx client/src/sources/jira/jira-builder.utils.js
git commit -m "feat: add jira template setup"
```

---

## Task 8: Jira Source-Owned AI Planner

**Files:**
- Create: `server/sources/plugins/jira/ai/jira.ai.js`
- Modify: `server/sources/plugins/jira/jira.plugin.js`
- Modify: `server/tests/unit/sourceAiHarness.test.js`

- [ ] **Step 1: Add failing harness tests**

Add Jira cases for:

```txt
open bugs by priority -> ok, issues grouped by priority, bar chart
stale issues -> ok, issues table
completed story points for active sprint -> needs_more_context when board/sprint missing
sprint health dashboard -> recommends sprint-health template
invalid field -> unsupported or error without raw Jira docs
```

Assert Jira does not expose `generateQuery`.

- [ ] **Step 2: Run harness to verify failure**

Run:

```bash
npm run test:run -- tests/unit/sourceAiHarness.test.js
```

Expected: FAIL because Jira AI is not implemented.

- [ ] **Step 3: Implement capabilities and resources**

Create `jira.ai.js`:

```js
const jiraProtocol = require("../jira.protocol");
const { JIRA_RESOURCES } = require("../jira.resources");

const SOURCE_ID = "jira";

const SOURCE_INSTRUCTIONS = [
  "Jira is configuration-based. Return DataRequest.configuration objects; do not invent Jira REST routes.",
  "Use issues for issue search and sprint_issues for sprint issue analytics.",
  "Ask for project, board, sprint, or field mapping context when required and missing.",
  "Do not create burndown or transition-history charts in v1.",
].join("\n");

function getCapabilities() {
  return {
    source: SOURCE_ID,
    instructions: SOURCE_INSTRUCTIONS,
    supports: {
      modes: ["visual", "jql", "advanced"],
      resources: Object.keys(JIRA_RESOURCES),
      variables: true,
      templates: ["project-overview", "sprint-health", "bug-tracking", "team-workload"],
    },
  };
}

function listResources() {
  return {
    source: SOURCE_ID,
    resources: Object.entries(JIRA_RESOURCES).map(([id, resource]) => ({
      id,
      label: resource.label,
    })),
  };
}
```

- [ ] **Step 4: Implement planner**

Add deterministic planning rules for the v1 supported questions:

```js
function planDataset({ question = "", overrides = {} }) {
  const normalized = question.toLowerCase();
  if (/sprint health/.test(normalized)) {
    return recommendTemplates({ question });
  }
  if (/bug/.test(normalized) && /priority/.test(normalized)) {
    return {
      status: "ok",
      dataRequest: {
        template: "jira",
        configuration: {
          source: "jira",
          resource: "issues",
          mode: "visual",
          jql: "project IN ({{projects}}) AND issuetype = Bug AND created >= {{start_date}} AND created <= {{end_date}}",
          transform: { type: "grouped", metric: "count", groupBy: "priority" },
          pagination: { startAt: 0, maxResults: 100, maxRecords: 5000 },
        },
      },
      chartSpec: { type: "bar", xAxis: "root[].priority", yAxis: "root[].issueCount" },
    };
  }
  return {
    status: "needs_more_context",
    message: "Choose a Jira project or template goal first.",
    requiredContext: ["projects"],
  };
}
```

Expand rules for stale issues, sprint story points, and template recommendations.

- [ ] **Step 5: Implement validation and preview wrappers**

Use:

```js
function validateConfiguration(configuration) {
  return jiraProtocol.validateConfiguration(configuration);
}

function previewConfiguration({ connection, configuration, rowLimit = 10 }) {
  return jiraProtocol.previewDataRequest({
    connection,
    dataRequest: {
      ...jiraProtocol.getDefaultDataRequest(),
      configuration: {
        ...configuration,
        pagination: {
          ...(configuration.pagination || {}),
          maxRecords: rowLimit,
        },
      },
    },
    itemsLimit: rowLimit,
  });
}
```

- [ ] **Step 6: Wire AI module**

Modify `jira.plugin.js`:

```js
const jiraAi = require("./ai/jira.ai");

backend: {
  ...jiraProtocol,
  ai: jiraAi,
},
```

- [ ] **Step 7: Run harness**

Run:

```bash
npm run test:run -- tests/unit/sourceAiHarness.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit Jira AI**

```bash
git add server/sources/plugins/jira/ai server/sources/plugins/jira/jira.plugin.js server/tests/unit/sourceAiHarness.test.js
git commit -m "feat: add jira source ai planner"
```

---

## Task 9: Generic AI Dashboard Template Tool

**Files:**
- Create: `server/modules/ai/orchestrator/tools/createDashboardFromTemplate.js`
- Modify: `server/modules/ai/orchestrator/tools/index.js`
- Modify: `server/modules/ai/orchestrator/orchestrator.js`
- Modify: `server/tests/unit/sourceAiHarness.test.js`

- [ ] **Step 1: Add failing tool tests**

Add tests that the tool:

```txt
accepts source, template_slug, connection_id, and dashboard options
rejects unsupported source/template combinations
calls ChartTemplateController.createFromTemplate
is generic and not Jira-specific
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test:run -- tests/unit/sourceAiHarness.test.js
```

Expected: FAIL because the tool is missing.

- [ ] **Step 3: Implement tool**

Create `createDashboardFromTemplate.js`:

```js
const ChartTemplateController = require("../../../controllers/ChartTemplateController");

async function createDashboardFromTemplate(payload) {
  const {
    team_id: teamId,
    source,
    template_slug: templateSlug,
    connection_id: connectionId,
    dashboard,
    dataset_template_ids: datasetTemplateIds,
    chart_template_ids: chartTemplateIds,
    user,
  } = payload;

  if (!teamId) throw new Error("team_id is required");
  if (!source) throw new Error("source is required");
  if (!templateSlug) throw new Error("template_slug is required");
  if (!connectionId) throw new Error("connection_id is required");

  const controller = new ChartTemplateController();
  return controller.createFromTemplate(teamId, source, templateSlug, {
    connection_id: connectionId,
    dashboard,
    dataset_template_ids: datasetTemplateIds,
    chart_template_ids: chartTemplateIds,
  }, user);
}

module.exports = createDashboardFromTemplate;
```

- [ ] **Step 4: Register tool**

Export it from `tools/index.js`, add a tool schema to `orchestrator.js`, and dispatch it in the tool switch. The schema should be source-agnostic:

```js
{
  name: "create_dashboard_from_template",
  displayName: "Create dashboard from template",
  description: "Create a dashboard/project from a registered source chart template.",
  parameters: {
    type: "object",
    properties: {
      source: { type: "string" },
      template_slug: { type: "string" },
      connection_id: { type: "string" },
      dashboard: { type: "object" },
      dataset_template_ids: { type: "array", items: { type: "string" } },
      chart_template_ids: { type: "array", items: { type: "string" } },
    },
    required: ["source", "template_slug", "connection_id", "dashboard"],
  },
}
```

- [ ] **Step 5: Run harness**

Run:

```bash
npm run test:run -- tests/unit/sourceAiHarness.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit generic dashboard-template tool**

```bash
git add server/modules/ai/orchestrator server/tests/unit/sourceAiHarness.test.js
git commit -m "feat: add ai dashboard template tool"
```

---

## Task 10: Full Verification

**Files:**
- All files from prior tasks.

- [ ] **Step 1: Run focused backend tests**

Run:

```bash
npm run test:run -- tests/unit/sourceRegistry.test.js tests/unit/sourcePluginStructure.test.js tests/unit/jiraProtocol.test.js tests/unit/jiraTemplates.test.js tests/unit/sourceAiHarness.test.js tests/integration/connectionRoute.security.test.js
```

Expected: PASS.

- [ ] **Step 2: Run server build/test command available for this repo**

Run:

```bash
npm run test:run -- --passWithNoTests
```

Expected: PASS.

- [ ] **Step 3: Run client build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Manual smoke check**

Start the app with the repo's normal dev command and verify:

```txt
Jira appears in the connection picker.
Jira connection form saves custom type/subType.
Jira builder opens for Jira datasets.
Visual/JQL/Advanced modes update DataRequest.configuration.
Template setup lists four Jira bundles.
AI source list includes Jira as source-owned configuration source.
```

- [ ] **Step 5: Commit verification fixes**

If verification required fixes:

```bash
git add server/sources/plugins/jira client/src/sources/jira server/tests/unit/jiraProtocol.test.js server/tests/unit/jiraTemplates.test.js server/tests/unit/sourceAiHarness.test.js
git commit -m "fix: verify jira source integration"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Jira custom identity is covered in Task 1 and Task 5.
- Jira Cloud API-token auth is covered in Task 2 and Task 5.
- Custom runtime, normalization, pagination, variables, and caching are covered in Task 3.
- Separate templates are covered in Task 4.
- Stripe Official-style frontend builder and setup UI are covered in Tasks 6 and 7.
- Source-owned AI parity is covered in Task 8.
- Generic dashboard-template AI side quest is covered in Task 9.
- Verification is covered in Task 10.

Known implementation risk:

- The template variable binding test in Task 4 may reveal that `ChartTemplateController.createFromTemplate(...)` does not preserve `dataRequest.variableBindings`. If so, implement the smallest controller pass-through fix in Task 4 before creating Jira templates that depend on variables.
