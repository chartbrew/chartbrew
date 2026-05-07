# Chartbrew source plugin architecture

## Context

Chartbrew currently supports multiple data source types, but source-specific behavior is spread across backend controllers, frontend connection screens, dataset builders, assets, templates, and AI/orchestrator behavior.

The goal of this work is to make adding and maintaining source types cleaner, more predictable, and easier for AI/contributors to work on.

This document was checked against the current `chartbrew-os` codebase and the Stripe/templates commit `ff2b5510300c7d8be2dda09bbf7df6b8c6ca2eb7` (`:sparkles: added Stripe connection and chart templates`, committed April 24, 2026). That commit is a good example of the current cost of adding a source: it touched connection picker metadata, connection form routing, a new connection form, next-step UI, new chart-template routes/controllers/loaders, Redux state, and hardcoded Stripe defaults.

Progress is tracked in [`chartbrew-source-plugin-progress.md`](./chartbrew-source-plugin-progress.md). For implementation steps, use [`source-plugin-guide.md`](./source-plugin-guide.md).

The current source-owned folder shape has been refined during implementation:

- Backend plugins live under `server/sources/plugins/<source>/`.
- Shared backend source helpers live under `server/sources/shared/`.
- Frontend source UI lives under `client/src/sources/<source>/`.
- Frontend shared source UI lives under `client/src/sources/shared/`.
- Source variants should stay as separate plugins when they may need different templates, AI behavior, defaults, or UI, and can declare `dependsOn` for their base plugin while sharing protocol/helper code when appropriate.

## High-level goal

Introduce an internal source plugin architecture where each source can define, in one predictable place:

- Source metadata: id, protocol type, subtype, name, category, description, logo/icon
- Availability: whether the source can run on the server and whether users can create new connections in the UI
- Capabilities: query support, schema support, templates, custom UI, AI support, action support
- Backend behavior: test connection, run data request, builder metadata, helper/source actions
- Frontend behavior: connection form, data request builder, next-step UI, source-specific setup UI
- Templates: built-in dataset/chart/dashboard starter templates
- AI context: source-specific instructions, query generation support, tool support
- Orchestrator tools: safe in-app tools the AI assistant can call for this source

The app should become capability-driven, not source-name-driven.

Prefer:

```js
source.capabilities.data.supportsQuery
source.capabilities.templates.charts
source.backend.runDataRequest(context)
source.ai?.tools?.recommendTemplates(context)
```

Instead of:

```js
connection.type === "postgres"
connection.type === "mongodb"
connection.subType === "stripe"
```

## Important codebase reality

Chartbrew currently has two source identity fields:

- `Connection.type`: the execution protocol/family. Examples: `api`, `mongodb`, `postgres`, `mysql`, `firestore`, `realtimedb`, `googleAnalytics`, `customerio`, `clickhouse`.
- `Connection.subType`: the brand or variant. Examples: `stripe`, `strapi`, `timescaledb`, `supabasedb`, `rdsPostgres`, `rdsMysql`.

This matters because some UI entries are user-facing source IDs but are not execution types. For example, Stripe is created as:

```js
{
  type: "api",
  subType: "stripe",
  host: "https://api.stripe.com/v1"
}
```

The first plugin registry should model both:

```js
{
  id: "stripe",
  type: "api",
  subType: "stripe",
}
```

For plain protocol sources, `id`, `type`, and `subType` can be the same or `subType` can be omitted:

```js
{
  id: "postgres",
  type: "postgres",
  subType: "postgres",
}
```

Use the plugin `id` for frontend picker/routes/assets/templates. Use `type` for shared protocol execution where that is still appropriate. Use `subType` only when the source variant really changes behavior.

## Important implementation rule

Do not build temporary migration layers, compatibility adapters, or parallel old/new systems that create future cleanup work.

It is acceptable to migrate one source or one execution path at a time, but each migrated area should replace the old branch with a registry/plugin call in that same PR.

Avoid:

- Long-lived adapter layers
- Duplicate registries
- Old controller branches kept beside new plugin calls
- Temporary compatibility code without a removal in the same PR
- New abstractions that only mirror the old structure without simplifying it

## Non-goals

Do not:

- Rewrite the entire app
- Propose a new project folder structure outside the existing client/server split
- Convert the project to TypeScript
- Extract source plugins into separate NPM packages yet
- Change the database schema unless clearly required
- Redesign the connection/dataset/chart UX from scratch
- Add external runtime plugin loading
- Break existing source behavior

This should be an architecture improvement inside the current project.

## Repo scan note

### Backend source-specific execution

Primary files:

- `server/controllers/ConnectionController.js`
  - Owns most connector behavior today.
  - Creation side effects: legacy `create()` preloads SQL schema for `mysql`, migrated source plugins can prepare create data themselves, and Mongo queues schema updates.
  - Test routing: `testRequest()` switches on `data.type`.
  - Saved connection testing: `testConnection()` switches on `connection.type`.
  - Request execution methods: `runApiRequest`, `runGoogleAnalytics`.
  - Builder metadata methods: `getApiBuilderMetadata`, `getGoogleAnalyticsBuilderMetadata`.
  - Source helper routing: `runHelperMethod()` currently only allows a fixed Customer.io helper-method list.
- `server/controllers/DataRequestController.js`
  - `getBuilderMetadata()` switches on `DataRequest.Connection.type`.
  - `runRequest()` switches on `connection.type`.
  - `askAi()` uses migrated source AI hooks before falling back to legacy query generation.
- `server/controllers/DatasetController.js`
  - Contains duplicated `connection.type` execution dispatch when running dataset data requests, including audit context.
  - This is currently the most important runtime path to migrate carefully because chart/dashboard refreshes depend on it.
- `server/controllers/ChartController.js`
  - Older preview/test paths still switch on `connection.type` for MongoDB/API/SQL.
- Connector helpers:
  - migrated shared SQL helper: `server/sources/shared/sql/externalDbConnection.js`
  - migrated Firestore helper: `server/sources/plugins/firestore/firestore.connection.js`
  - migrated RealtimeDB helper: `server/sources/plugins/realtimedb/realtimedb.connection.js`
  - `server/connections/CustomerioConnection.js`
  - migrated ClickHouse helper: `server/sources/plugins/clickhouse/clickhouse.connection.js`
  - `server/modules/googleConnector.js`
  - `server/modules/paginateRequests.js`

### Backend routes

Primary files:

- `server/api/ConnectionRoute.js`
  - Connection CRUD.
  - Unsaved connection tests: `POST /team/:team_id/connections/:type/test`.
  - File-backed tests: `POST /team/:team_id/connections/:type/test/files`.
  - Saved connection test: `GET /team/:team_id/connections/:connection_id/test`.
  - API request preview: `POST /team/:team_id/connections/:connection_id/apiTest`.
  - Source helper route: `POST /team/:team_id/connections/:connection_id/helper/:method`.
- `server/api/DatasetRoute.js` and `server/api/ChartRoute.js`
  - Runtime execution enters `DatasetController`/`ChartController`.
- `server/api/ChartTemplateRoute.js`
  - New built-in chart-template route from the Stripe commit.

### Backend templates

There are two template systems today:

- Older dashboard/community/custom templates:
  - `server/templates/index.js`
  - `server/templates/{googleAnalytics,plausible,simpleanalytics,chartmogul,mailgun,strapi,custom}/...`
  - `server/controllers/TemplateController.js`
  - `server/api/TemplateRoute.js`
  - `server/controllers/ProjectController.js` calls template builders.
- New built-in chart templates added for Stripe:
  - `server/sources/shared/templates/chartTemplateLoader.js`
  - `server/sources/plugins/stripe/templates/core-revenue.json`
  - `server/controllers/ChartTemplateController.js`
  - `server/api/ChartTemplateRoute.js`

The new Stripe chart-template system is closer to the desired plugin-owned template model. Stripe template files and Stripe data-request defaults should stay in the Stripe plugin folder; the shared chart-template loader should discover templates from registered source plugins.

### Backend AI/orchestrator

Primary files:

- `server/modules/ai/orchestrator/orchestrator.js`
  - Hardcodes supported sources in tool descriptions and system prompt.
  - `buildSystemPrompt()` filters available connections to `mysql`, `postgres`, and `mongodb`.
  - `buildSemanticLayer()` loads all team connections, but later prompt/tool layers narrow support.
- `server/modules/ai/orchestrator/entityCreationRules.js`
  - Hardcodes supported connection types/subtypes.
- `server/modules/ai/orchestrator/tools/listConnections.js`
  - Filters connections through `SUPPORTED_CONNECTIONS`.
- `server/modules/ai/orchestrator/tools/getSchema.js`
  - Rejects unsupported types.
- `server/modules/ai/orchestrator/tools/runQuery.js`
  - Dispatches migrated runtime sources through the source registry.
- `server/modules/ai/generateSqlQuery.js`
- `server/modules/ai/generateMongoQuery.js`
- `server/modules/ai/generateClickhouseQuery.js`

### Frontend source metadata and assets

Primary files:

- `client/src/modules/availableConnections.js`
  - User-facing picker list and AI badge flags.
  - Contains subtype-like entries such as `stripe`, `strapi`, `timescaledb`, `supabasedb`, `rdsPostgres`, `rdsMysql`.
- `client/src/config/connectionImages.js`
  - Central image map keyed by `type` or `subType`.
- `client/src/assets/*`
  - Connection logos.

### Frontend connection forms and next-step UI

Primary files:

- `client/src/containers/Connections/ConnectionWizard.jsx`
  - Reads connection picker items and connection forms from `client/src/sources/index.js`.
  - Uses the selected source definition to render forms.
  - Uses `connectionToEdit.subType || connectionToEdit.type` for edit routing.
- Connection forms:
  - `client/src/containers/Connections/components/ApiConnectionForm.jsx`
  - migrated source-owned forms:
    - `client/src/sources/mongodb/mongodb-connection-form.jsx`
    - `client/src/sources/postgres/postgres-connection-form.jsx`
    - `client/src/sources/mysql/mysql-connection-form.jsx`
  - `client/src/containers/Connections/GoogleAnalytics/GaConnectionForm.jsx`
  - `client/src/containers/Connections/Strapi/StrapiConnectionForm.jsx`
  - migrated source-owned forms:
    - `client/src/sources/clickhouse/clickhouse-connection-form.jsx`
    - `client/src/sources/firestore/firestore-connection-form.jsx`
    - `client/src/sources/realtimedb/realtimedb-connection-form.jsx`
    - `client/src/sources/stripe/stripe-connection-form.jsx`
    - `client/src/sources/customerio/customerio-connection-form.jsx`
- `client/src/containers/Connections/ConnectionNextSteps.jsx`
  - Resolves chart-template setup from `source.frontend.ChartTemplateSetup`.
  - Otherwise renders generic next steps.
- `client/src/sources/stripe/stripe-template-setup.jsx`
  - Stripe Legacy UI for chart-template selection and creation.

### Frontend dataset/data request builder

Primary files:

- `client/src/containers/Dataset/DatasetQuery.jsx`
  - Main current dataset query UI.
  - Resolves data request builders through `findSourceForConnection(...)` from `client/src/sources/index.js`.
- `client/src/containers/AddChart/components/DatarequestModal.jsx`
  - Older modal path that now uses the same frontend source registry for builder resolution.
- Builder components:
  - `client/src/containers/AddChart/components/ApiBuilder.jsx`
  - `client/src/sources/shared/sql/sql-builder.jsx`
  - `client/src/containers/Connections/GoogleAnalytics/GaBuilder.jsx`
  - migrated source-owned builders:
    - `client/src/sources/clickhouse/clickhouse-builder.jsx`
    - `client/src/sources/firestore/firestore-builder.jsx`
    - `client/src/sources/realtimedb/realtimedb-builder.jsx`
    - `client/src/sources/mongodb/mongodb-builder.jsx`
    - `client/src/sources/customerio/customerio-builder.jsx`
- `client/src/containers/AddChart/components/ApiBuilder.jsx`
  - Contains Stripe-specific behavior by detecting `api.stripe.com` and setting `dataRequest.template = "stripe"`.

### Constants/enums for source types

There is no single authoritative source enum today.

Current source identifiers are spread across:

- `client/src/modules/availableConnections.js`
- `client/src/config/connectionImages.js`
- `server/controllers/ConnectionController.js`
- `server/controllers/DataRequestController.js`
- `server/controllers/DatasetController.js`
- `server/modules/ai/orchestrator/entityCreationRules.js`
- source-owned template folders under `server/sources/plugins/<source>/templates`
- Connection form defaults

The plugin registry should become the authoritative source manifest for new code paths.

### Tests/lint/build commands

From current package scripts:

- Root:
  - `npm run setup`
  - `npm run client`
  - `npm run server`
- Server:
  - `cd server && npm run test:run`
  - `cd server && npm run test:unit`
  - `cd server && npm run test:integration`
  - `cd server && npm run lint`
- Client:
  - `cd client && npm run build`
  - `cd client && npm run lint`
  - `cd client && npm run dev`

Existing relevant tests:

- `server/tests/unit/chartTemplateLoader.test.js`
- `server/tests/unit/stripeConnectionOptions.test.js`
- `server/tests/integration/chartTemplateRoute.test.js`
- `server/tests/integration/connectionRoute.security.test.js`
- `server/tests/integration/datasetRoute.projectScoping.test.js`
- `server/tests/unit/orchestratorResponsesApi.test.js`

## Proposed plugin shape

Keep the contract small at first. Add fields only when the app actually needs them.

### Source availability and disabling

Source availability must be separate on the backend and frontend. These flags solve different problems and should not be coupled:

- Server availability controls whether Chartbrew is allowed to make outbound requests to the source.
- UI availability controls whether users can create new connections for the source from the Chartbrew UI.

Disabling the server side must stop every external-call path for that source, including saved/unsaved connection tests, previews, runtime data requests, schema loading, source actions, create-time preparation hooks, and AI/orchestrator source tools. The app should return a clear source-disabled error before calling source-owned protocol code. Do not implement server disabling by hiding the source from the registry, because existing connections still need to resolve to a source so the app can explain why they cannot run.

Disabling the UI side should remove the source only from new-connection creation surfaces, such as the connection picker and direct create routes driven by `?type=...`. It should not remove the source definition globally, because existing connections may still need logos, names, edit screens, dataset builders, templates, and next-step metadata.

Use an explicit availability block instead of overloading capabilities:

```js
availability: {
  server: {
    enabled: true,
  },
  ui: {
    canCreateConnections: true,
  },
}
```

Default omitted availability values to enabled/creatable so existing plugin manifests remain concise.

Configuration should be host-owned, not hardcoded only in source files. The plugin manifest can declare defaults, but environment or site config should be able to override them later. For example, a self-hosted Chartbrew instance should be able to set:

```txt
CB_DISABLED_SERVER_SOURCES=stripe,customerio
VITE_DISABLED_UI_SOURCES=googleAnalytics
```

Those are intentionally separate. `CB_DISABLED_SERVER_SOURCES=stripe` means existing Stripe connections cannot make API calls. `VITE_DISABLED_UI_SOURCES=stripe` means users cannot create new Stripe connections from the UI, but existing Stripe connections may still run if server availability remains enabled.

Suggested CommonJS backend shape:

```js
module.exports = {
  id: "stripe",
  type: "api",
  subType: "stripe",
  name: "Stripe",
  category: "payments",
  description: "Connect to Stripe reporting data through the Stripe API.",

  availability: {
    server: {
      enabled: true,
    },
  },

  capabilities: {
    connection: {
      supportsTest: true,
      supportsOAuth: false,
      supportsFiles: false,
      authModes: ["basic_auth"],
    },
    data: {
      supportsQuery: false,
      supportsSchema: false,
      supportsResourcePicker: true,
      supportsPagination: true,
      supportsVariables: true,
      supportsJoins: true,
    },
    ui: {
      connectionForm: true,
      dataRequestBuilder: "api",
      queryEditor: null,
      nextSteps: "chartTemplates",
    },
    templates: {
      datasets: true,
      charts: true,
      dashboards: false,
    },
    ai: {
      canGenerateDatasets: false,
      canGenerateQueries: false,
      hasSourceInstructions: true,
      hasTools: true,
    },
  },

  backend: {
    testConnection,
    testUnsavedConnection,
    runDataRequest,
    getBuilderMetadata,
    actions,
  },

  templates: {
    charts: ["core-revenue"],
  },

  ai: {
    instructions,
    tools,
  },
};
```

Suggested ESM frontend shape:

```jsx
export default {
  id: "stripe",
  type: "api",
  subType: "stripe",
  name: "Stripe",
  category: "payments",
  description: "Connect to Stripe reporting data through the Stripe API.",
  availability: {
    ui: {
      canCreateConnections: true,
    },
  },
  capabilities,
  assets: {
    lightLogo,
    darkLogo,
  },
  frontend: {
    ConnectionForm: StripeConnectionForm,
    DataRequestBuilder: ApiBuilder,
    NextSteps: ChartTemplateNextSteps,
  },
};
```

## Backend registry

Create a backend registry under a server-local path, for example:

```txt
server/sources/index.js
server/sources/validateSourcePlugin.js
server/sources/plugins/api/api.plugin.js
server/sources/plugins/mongodb/mongodb.plugin.js
server/sources/plugins/postgres/postgres.plugin.js
server/sources/plugins/mysql/mysql.plugin.js
server/sources/plugins/rdsmysql/rdsmysql.plugin.js
server/sources/plugins/stripe/stripe.plugin.js
server/sources/shared/protocols/api.protocol.js
server/sources/shared/sql/sql.protocol.js
```

Suggested interface:

```js
function getSourceById(id) {
  const source = sources.find((item) => item.id === id);
  if (!source) throw new Error(`Unsupported source id: ${id}`);
  return source;
}

function getSourceForConnection(connection) {
  const sourceId = connection.subType || connection.type;
  const source = sources.find((item) => item.id === sourceId)
    || sources.find((item) => item.type === connection.type && !item.subType);

  if (!source) {
    throw new Error(`Unsupported connection source: ${sourceId}`);
  }

  return source;
}

function getSourceSummaries() {
  return sources.map((source) => ({
    id: source.id,
    type: source.type,
    subType: source.subType,
    name: source.name,
    category: source.category,
    description: source.description,
    availability: source.availability,
    capabilities: source.capabilities,
  }));
}
```

Use `getSourceForConnection(connection)` to replace source-specific branching in backend source execution paths.

Add central backend availability helpers to avoid per-controller drift:

```js
function assertSourceServerEnabled(source) {
  if (source.availability?.server?.enabled === false) {
    throw new Error(`Source ${source.id} is disabled on this server`);
  }
}
```

Call this before every source-owned hook that can make an outbound request. Registry lookup should still return disabled sources; execution wrappers and routes should reject them before protocol code runs.

Target replacement style:

```js
const source = getSourceForConnection(connection);

const result = await source.backend.runDataRequest({
  connection,
  dataRequest: originalDataRequest,
  chartId: chart_id,
  getCache,
  filters,
  timezone,
  variables,
  processedQuery,
  auditContext,
});
```

## Frontend registry

Create a frontend registry under a client-local path, for example:

```txt
client/src/sources/index.js
client/src/sources/definitions.js
client/src/sources/stripe/stripe.source.js
client/src/sources/stripe/stripe-connection-form.jsx
client/src/sources/customerio/customerio.source.js
client/src/sources/customerio/customerio-connection-form.jsx
client/src/sources/customerio/customerio-builder.jsx
```

Use it for:

- Connection picker, filtering by `availability.ui.canCreateConnections !== false`
- Source display names
- Logos/icons
- Category grouping
- Source capability checks
- Connection form resolution
- Data request builder resolution
- Source-specific next-step UI

Target replacement style:

```jsx
const source = getSourcePlugin(selectedType);
const ConnectionForm = source.frontend.ConnectionForm;

return (
  <ConnectionForm
    onComplete={onComplete}
    editConnection={editConnection}
    subType={source.subType}
  />
);
```

For data request builders:

```jsx
const source = getSourceForConnection(selectedRequest.Connection);
const DataRequestBuilder = source.frontend.DataRequestBuilder;

return (
  <DataRequestBuilder
    dataRequest={dr}
    connection={dr.Connection}
    onChangeRequest={onChangeRequest}
    onSave={onSave}
    onDelete={onDelete}
  />
);
```

Keep two separate frontend access patterns:

- `getSourcePickerItems()` or a dedicated `getCreatableSourcePickerItems()` should filter out sources with `availability.ui.canCreateConnections === false`.
- `getSourcePlugin(id)` and `getSourceForConnection(connection)` should still return UI-disabled sources so existing connections can render consistently.

## Source actions

Replace `ConnectionController.runHelperMethod()` and `/helper/:method` with a generic action mechanism.

Existing route to migrate:

```txt
POST /team/:team_id/connections/:connection_id/helper/:method
```

Preferred route, following existing route conventions:

```txt
POST /team/:team_id/connections/:connection_id/source-action
```

Example payload:

```json
{
  "action": "listResources",
  "params": {
    "resource": "customers"
  }
}
```

Backend behavior:

```js
const source = getSourceForConnection(req.connection);
const action = source.backend.actions?.[req.body.action];

if (!action) {
  throw new Error("Unsupported source action");
}

const result = await action({
  connection: req.connection,
  params: req.body.params || {},
  user: req.user,
  teamId: req.params.team_id,
});

return res.json(result);
```

Rules:

- Validate action names against registered actions.
- Validate params per action.
- Reuse existing auth/team/connection access checks.
- Do not expose credentials.
- Return compact structured data.
- Keep action names generic across sources where possible.

Useful common actions:

```txt
listResources
getSchema
getSampleData
previewDataRequest
validateDataRequest
listTemplates
recommendTemplates
```

Useful SQL-specific actions:

```txt
listSchemas
listTables
listColumns
previewQuery
validateQuery
```

## Templates

Built-in source templates should be owned by the source plugin.

The current Stripe implementation is the reference shape:

- Keep Stripe data-request defaults in the Stripe source plugin.
- Let `ChartTemplateController` ask the source/plugin how to create template data requests.
- Keep the shared loader generic, but make it resolve template files through source plugin metadata.
- Preserve the current JSON template shape unless a plugin requirement forces a change.

A source may expose:

```js
templates: {
  directory: path.join(__dirname, "templates"),
  chartTemplates: ["core-revenue"],
  defaults: {
    dataRequest: {},
  },
}
```

Start with listing and creating existing chart templates. Add broader dashboard/template unification later.

## AI and orchestrator tools

The in-app AI/orchestrator should not hardcode source behavior.

Each source plugin can provide:

```js
ai: {
  instructions,
  examples,
  getContext,
  tools,
}
```

The orchestrator should compose:

- Global Chartbrew AI instructions
- User goal
- Current team/project/dashboard context
- Selected connection/source metadata
- Source capabilities
- Source-specific AI instructions
- Available source templates
- Available source tools

Do not dump huge schemas or raw datasets into the prompt. Prefer tool calls.

First AI migration should replace these hardcoded lists with plugin capabilities:

- `SUPPORTED_CONNECTIONS` in `server/modules/ai/orchestrator/entityCreationRules.js`
- Tool descriptions in `server/modules/ai/orchestrator/orchestrator.js`
- Connection filtering in `server/modules/ai/orchestrator/tools/listConnections.js`
- Type support checks in `getSchema`, `runQuery`, and `createDataset`

## Orchestrator tool contract

Expose source tools through a controlled adapter, not directly through arbitrary plugin functions.

Example conceptual shape:

```js
{
  name: "source.getSampleData",
  description: "Fetch a small sample from the selected source.",
  inputSchema: {
    type: "object",
    properties: {
      resource: { type: "string" },
    },
    required: ["resource"],
  },
  execute: async ({ resource }) => {
    return source.backend.actions.getSampleData({
      connection,
      params: { resource },
      user,
      teamId,
    });
  },
}
```

Rules:

- Tools must be explicitly registered.
- Tools must validate input.
- Tools must be scoped to the authenticated user/team/connection.
- Tools must return compact, structured data.
- Read-only tools should come before write/create tools.
- Create/update tools should require clear user intent.
- Use existing services where possible.
- Prefer stable generic tool names.

Start with read-only tools:

```txt
source.getCapabilities
source.listResources
source.getSchema
source.getSampleData
source.listTemplates
source.recommendTemplates
```

Add create tools later.

## Validation

Add lightweight validation for source plugins.

At minimum:

```js
function validateSourcePlugin(plugin) {
  if (!plugin.id) throw new Error("Source plugin is missing id");
  if (!plugin.type) throw new Error(`Source plugin ${plugin.id} is missing type`);
  if (!plugin.name) throw new Error(`Source plugin ${plugin.id} is missing name`);
  if (!plugin.capabilities) throw new Error(`Source plugin ${plugin.id} is missing capabilities`);
  if (!plugin.backend) throw new Error(`Source plugin ${plugin.id} is missing backend`);
}
```

Validate:

- Unique source IDs.
- Valid `type`/`subType` combinations.
- Optional `availability.server.enabled` and `availability.ui.canCreateConnections` booleans.
- Required manifest fields.
- Required backend functions for enabled capabilities.
- Required frontend components for enabled UI capabilities.
- Template shape.
- Source action names.
- Orchestrator tool schemas.

## Suggested migration order

1. Add backend source registry and validation.
2. Add frontend source registry and replace `availableConnections`/`connectionImages` usage in the connection picker.
3. Migrate one frontend form-resolution path in `ConnectionWizard`.
4. Migrate data request builder resolution in `DatasetQuery`.
5. Migrate `DataRequestController.getBuilderMetadata()` to source metadata/actions.
6. Extract shared backend data-request execution dispatch from `DatasetController` and `DataRequestController` into a source registry call.
7. Move Stripe chart-template files and defaults into the Stripe plugin.
8. Replace `ConnectionNextSteps` Stripe branching with plugin next-step capability/UI.
9. Replace Customer.io helper methods with generic source actions.
10. Move AI/orchestrator source support from hardcoded lists to source capabilities.

## Smallest safe source to migrate first

Recommended first source: `stripe`.

Reasoning:

- It was just added in commit `ff2b5510300c7d8be2dda09bbf7df6b8c6ca2eb7`, so the source-specific changes are easy to identify.
- It is a subtype source (`type: "api"`, `subType: "stripe"`), which forces the registry to model the real `type`/`subType` architecture from the start.
- Its runtime data fetching already uses the generic API execution path, so the first migration can focus on metadata, connection form resolution, next-step/template ownership, and pagination/template defaults without changing low-level HTTP execution.
- Existing Stripe tests cover connection options and chart-template loading/routes.

Second source after Stripe: `postgres`, followed by `mysql`.

Reasoning:

- It exercises schema/query/AI capabilities.
- It shares execution with `mysql`, so the shared SQL protocol should be introduced before both SQL sources are fully migrated.
- MySQL should migrate with its `rdsMysql` variant as a separate dependent plugin.

Avoid migrating `api` first. It is the generic protocol base for several branded sources and would make the first PR too broad.

## Recommended first deliverable

Keep the first implementation pass small:

- Backend source registry with validation.
- Frontend source registry with validation-light conventions.
- Stripe plugin manifest on both backend and frontend.
- Connection picker reads from frontend registry instead of `availableConnections`.
- `ConnectionWizard` resolves the Stripe form through the registry.
- `ConnectionNextSteps` resolves Stripe template setup through plugin metadata/UI instead of `connection.subType === "stripe"`.
- `ChartTemplateController` gets Stripe data-request defaults from the Stripe backend plugin.
- Tests updated/added around registry validation and existing Stripe template behavior.

# Chartbrew source plugin progress

Last updated: May 1, 2026

## Current branch

`connection-plugins`

## Implementation guide

Use [`source-plugin-guide.md`](./source-plugin-guide.md) as the exact checklist for adding or migrating sources.

## Completed in first implementation slice

- Added backend source registry:
  - `server/sources/index.js`
  - `server/sources/validateSourcePlugin.js`
  - `server/sources/plugins/stripe/stripe.plugin.js`
- Added shared backend API protocol module:
  - `server/sources/shared/protocols/api.protocol.js`
- Added a Stripe backend source plugin with:
  - `id: "stripe"`
  - `type: "api"`
  - `subType: "stripe"`
  - source capabilities
  - chart-template data request defaults
  - delegated API execution/test/metadata methods
- Updated `server/controllers/ChartTemplateController.js` so Stripe chart-template data request defaults come from the source plugin instead of a controller-level `DEFAULT_STRIPE_DATA_REQUEST`.
- Updated `server/controllers/DataRequestController.js` so migrated source plugins can provide builder metadata before falling back to the existing type switch.
- Added frontend source registry:
  - `client/src/sources/index.js`
  - `client/src/sources/definitions.js`
- Moved connection picker metadata into the frontend registry. Migrated sources now keep metadata in source-local modules, while `definitions.js` remains a legacy bridge for unmigrated sources.
- Kept `client/src/modules/availableConnections.js` as a compatibility shim that derives from the registry for existing imports.
- Updated `client/src/containers/Connections/ConnectionWizard.jsx` so:
  - source cards come from the registry
  - logos come from source assets
  - connection forms resolve through `source.frontend.ConnectionForm`
  - the old explicit form branches were removed
- Updated `client/src/containers/Connections/ConnectionNextSteps.jsx` so Stripe template setup is capability-driven instead of checking `connection.subType === "stripe"`.
- Updated `client/src/containers/AddChart/components/ApiBuilder.jsx` so Stripe API request defaults come from source metadata instead of detecting `api.stripe.com`.
- Updated `client/src/containers/Dataset/DatasetQuery.jsx` so data request builders resolve through `source.frontend.DataRequestBuilder` instead of explicit `Connection.type` branches.
- Added backend unit coverage in `server/tests/unit/sourceRegistry.test.js`.

## Completed in second implementation slice

- Added a backend Customer.io source plugin:
  - `server/sources/plugins/customerio/customerio.plugin.js`
  - `id: "customerio"`
  - `type: "customerio"`
  - `subType: "customerio"`
  - source capabilities
  - an explicit source-action allowlist
- Registered Customer.io in the backend source registry.
- Added a generic plugin action route:
  - `POST /team/:team_id/connections/:connection_id/source-action`
- Kept the existing Customer.io helper route in place for compatibility.
- Moved the active Customer.io Redux thunk path to the new source-action endpoint while keeping the existing `runHelperMethod(...)` function name for current component imports.
- Added `runSourceAction(...)` as the forward-facing Redux thunk for new source-action callers.
- Added route security coverage for source actions:
  - allows exposed actions for project-scoped connections the user can access
  - rejects actions not exposed by the source plugin
  - rejects source actions for same-team connections outside the caller's assigned projects
- Extended backend source registry unit coverage for Customer.io.

## Completed in third implementation slice

- Added a Customer.io backend protocol module:
  - `server/sources/plugins/customerio/customerio.protocol.js`
- Wired the Customer.io source plugin to own:
  - saved connection tests
  - unsaved connection tests
  - runtime data-request execution
  - source actions
- Added a shared source runtime dispatcher:
  - `server/sources/runSourceDataRequest.js`
- Updated runtime data-request execution so migrated source plugins are tried before the old connection-type switch:
  - `server/controllers/DataRequestController.js`
  - `server/controllers/DatasetController.js`
- Updated connection test routes so migrated source plugins are tried before `ConnectionController` fallback:
  - `GET /team/:team_id/connections/:connection_id/test`
  - `POST /team/:team_id/connections/:type/test`
  - `POST /team/:team_id/connections/:type/test/files`
- Moved the older chart `DatarequestModal.jsx` builder and logo resolution to the frontend source registry.
- Updated active Customer.io builder components to call `runSourceAction(...)` instead of `runHelperMethod(...)`.
- Removed the unused slice-level `runHelperMethod(...)` compatibility thunk from `client/src/slices/connection.js`.
- Removed the legacy Customer.io helper route:
  - `POST /team/:team_id/connections/:connection_id/helper/:method`
- Removed the unused legacy helper action from `client/src/actions/connection.js`.
- Moved Customer.io runtime/test ownership out of `ConnectionController` and into `server/sources/plugins/customerio/customerio.protocol.js`.
- Removed Customer.io branches from `ConnectionController`, `DataRequestController`, and `DatasetController` fallback switches.
- Extracted shared connector cache/audit helpers into:
  - `server/sources/shared/connectorRuntime.js`
- Extended source registry unit tests for:
  - Customer.io runtime methods
  - migrated source runner resolution for Stripe and Customer.io
  - fallback behavior for non-migrated generic API connections

## Completed in final Stripe/Customer.io closeout

- Kept Stripe on the shared API protocol; no native Stripe protocol was added.
- Updated `apiTest` so migrated API sources can provide preview behavior before the generic API fallback.
- Added route coverage that verifies Stripe API previews use the source plugin hook.
- Moved the Customer.io implementation module from `server/connections` into the source tree:
  - `server/sources/plugins/customerio/customerio.connection.js`
- Updated Customer.io source actions, runtime methods, and tests to use the source-owned implementation module.
- Added a frontend connection logo helper:
  - `client/src/modules/getConnectionLogo.js`
- Replaced remaining direct connection display logo lookups with registry-first logo resolution.
- Standardized source-specific filenames:
  - backend source files use `<source>.<role>.js`, such as `customerio.protocol.js`
  - frontend source UI files use `<source>-<role>.jsx`, such as `customerio-builder.jsx`
- Moved migrated frontend source UI into source-owned folders:
  - `client/src/sources/postgres/postgres.source.js`
  - `client/src/sources/postgres/postgres-connection-form.jsx`
  - `client/src/sources/postgres/postgres-builder.jsx`
  - `client/src/sources/postgres/assets/*`
  - `client/src/sources/shared/sql/sql-builder.jsx`
  - `client/src/sources/stripe/stripe.source.js`
  - `client/src/sources/stripe/stripe-connection-form.jsx`
  - `client/src/sources/stripe/assets/*`
  - `client/src/sources/customerio/customerio.source.js`
  - `client/src/sources/customerio/customerio-connection-form.jsx`
  - `client/src/sources/customerio/customerio-builder.jsx`
  - `client/src/sources/customerio/customerio-*-query.jsx`
  - `client/src/sources/customerio/assets/*`
- Moved Stripe chart templates into the Stripe plugin folder:
  - `server/sources/plugins/stripe/templates/core-revenue.json`
- Moved the shared chart-template loader to `server/sources/shared/templates/chartTemplateLoader.js`.
- Updated chart-template loading so built-in chart templates are discovered from registered source plugins.

## Completed in Postgres migration slice

- Added the backend Postgres source plugin:
  - `server/sources/plugins/postgres/postgres.plugin.js`
  - `server/sources/plugins/postgres/postgres.protocol.js`
- Moved Postgres connection testing, create-time schema loading, data-request execution, AI schema loading, and legacy chart SQL query execution into the Postgres source protocol.
- Updated runtime dispatch to pass processed SQL queries to migrated source plugins.
- Removed Postgres from legacy MySQL/Postgres fallback branches; MySQL stays on the legacy SQL path until its own plugin migration.
- Added source-local Postgres frontend files and assets:
  - `client/src/sources/postgres/postgres.source.js`
  - `client/src/sources/postgres/postgres-connection-form.jsx`
  - `client/src/sources/postgres/postgres-builder.jsx`
  - `client/src/sources/postgres/assets/*`
- Moved the shared SQL builder to:
  - `client/src/sources/shared/sql/sql-builder.jsx`

## Completed in shared SQL/Postgres cleanup slice

- Added a shared SQL backend folder for reusable SQL runtime code:
  - `server/sources/shared/sql/externalDbConnection.js`
  - `server/sources/shared/sql/sql.protocol.js`
- Copied `server/modules/externalDbConnection.js` into the shared SQL source folder for migrated plugins. The legacy module stays in place until MySQL is migrated.
- Refactored the Postgres protocol into a thin source-owned wrapper around the shared SQL protocol.
- Kept source ownership for Postgres-specific behavior by passing `connectionType: "postgres"` from `server/sources/plugins/postgres/postgres.protocol.js`.
- Added the first source-owned AI query hook shape for Postgres:
  - `backend.ai.getSchema`
  - `backend.ai.generateQuery`
- Updated `DataRequestController.askAi(...)` to use source AI hooks before falling back to the legacy MongoDB/ClickHouse/SQL generator switch.
- Formalized `prepareConnectionData(...)` as an optional backend plugin hook and validated AI query hooks for sources that declare `canGenerateQueries`.
- Added optional `dependsOn` validation so future variant plugins can explicitly depend on a base plugin such as Postgres.
- Added direct unit coverage that verifies processed SQL queries are passed through the Postgres plugin wrapper.

## Completed in MySQL migration slice

- Added backend MySQL source plugins:
  - `server/sources/plugins/mysql/mysql.plugin.js`
  - `server/sources/plugins/mysql/mysql.protocol.js`
  - `server/sources/plugins/rdsmysql/rdsmysql.plugin.js`
  - `server/sources/plugins/rdsmysql/rdsmysql.protocol.js`
- Kept RDS MySQL as its own variant plugin with `dependsOn: ["mysql"]`.
- Wired MySQL and RDS MySQL to the shared SQL runtime for:
  - saved connection tests
  - unsaved connection tests
  - create-time schema loading
  - data-request execution
  - chart query previews
  - AI query generation hooks
- Removed MySQL from legacy controller dispatch in:
  - `server/controllers/ConnectionController.js`
  - `server/controllers/DataRequestController.js`
  - `server/controllers/DatasetController.js`
  - `server/controllers/ChartController.js`
- Updated AI orchestrator query execution to route migrated SQL sources through the source registry before falling back to MongoDB legacy execution.
- Removed the legacy SQL connector module:
  - `server/modules/externalDbConnection.js`
- Moved MySQL frontend files and assets into source-owned folders:
  - `client/src/sources/mysql/mysql.source.js`
  - `client/src/sources/mysql/mysql-connection-form.jsx`
  - `client/src/sources/mysql/mysql-builder.jsx`
  - `client/src/sources/mysql/assets/*`
  - `client/src/sources/rdsmysql/rdsmysql.source.js`
  - `client/src/sources/rdsmysql/assets/*`

## Completed in Postgres variants migration slice

- Added separate backend plugins for Postgres variants:
  - `server/sources/plugins/timescaledb/timescaledb.plugin.js`
  - `server/sources/plugins/timescaledb/timescaledb.protocol.js`
  - `server/sources/plugins/supabasedb/supabasedb.plugin.js`
  - `server/sources/plugins/supabasedb/supabasedb.protocol.js`
  - `server/sources/plugins/rdspostgres/rdspostgres.plugin.js`
  - `server/sources/plugins/rdspostgres/rdspostgres.protocol.js`
- Kept TimescaleDB, Supabase DB, and RDS Postgres as separate source plugins with `dependsOn: ["postgres"]`.
- Wired all three variants to the shared SQL runtime for tests, create-time schema loading, data-request execution, chart query previews, and AI query generation hooks.
- Moved variant frontend metadata/assets into source-owned folders:
  - `client/src/sources/timescaledb/*`
  - `client/src/sources/supabasedb/*`
  - `client/src/sources/rdspostgres/*`
- Added variant-local frontend form/builder wrappers that delegate to the existing Postgres form and shared SQL builder.
- Updated registry coverage for Postgres variant lookup and processed SQL query routing.

## Completed in MongoDB migration slice

- Added the backend MongoDB source plugin:
  - `server/sources/plugins/mongodb/mongodb.plugin.js`
  - `server/sources/plugins/mongodb/mongodb.protocol.js`
- Moved MongoDB connection testing, runtime data-request execution, chart query previews, schema refresh, create-time schema update queueing, and AI query generation hooks into the MongoDB source protocol.
- Updated connection creation and schema-refresh routing so MongoDB-specific post-create/update behavior resolves through the source plugin instead of `ConnectionController`.
- Removed MongoDB runtime/test/query-preview branches from:
  - `server/controllers/ConnectionController.js`
  - `server/controllers/DataRequestController.js`
  - `server/controllers/DatasetController.js`
  - `server/controllers/ChartController.js`
  - `server/modules/ai/orchestrator/tools/runQuery.js`
- Moved MongoDB frontend files and assets into a source-owned folder:
  - `client/src/sources/mongodb/mongodb.source.js`
  - `client/src/sources/mongodb/mongodb-connection-form.jsx`
  - `client/src/sources/mongodb/mongodb-builder.jsx`
  - `client/src/sources/mongodb/assets/*`
- Updated registry and structure coverage for MongoDB source lookup and source-owned files.

## Completed in ClickHouse migration slice

- Added the backend ClickHouse source plugin:
  - `server/sources/plugins/clickhouse/clickhouse.plugin.js`
  - `server/sources/plugins/clickhouse/clickhouse.protocol.js`
  - `server/sources/plugins/clickhouse/clickhouse.connection.js`
  - `server/sources/plugins/clickhouse/clickhouse.client.js`
- Moved ClickHouse connection testing, create-time schema loading, data-request execution, chart query previews, and AI query generation hooks into the ClickHouse source protocol.
- Removed ClickHouse runtime/test/schema branches from:
  - `server/controllers/ConnectionController.js`
  - `server/controllers/DataRequestController.js`
  - `server/controllers/DatasetController.js`
- Moved ClickHouse frontend files and assets into a source-owned folder:
  - `client/src/sources/clickhouse/clickhouse.source.js`
  - `client/src/sources/clickhouse/clickhouse-connection-form.jsx`
  - `client/src/sources/clickhouse/clickhouse-builder.jsx`
  - `client/src/sources/clickhouse/assets/*`
- Removed the legacy ClickHouse connector module folder from active imports:
  - `server/modules/clickhouse/*`
- Updated registry and structure coverage for ClickHouse source lookup, runtime query routing, and source-owned files.

## Completed in AI orchestrator source-plugin wiring slice

- Added a shared AI orchestrator source-support helper:
  - `server/modules/ai/orchestrator/sourceSupport.js`
- Updated orchestrator source support to resolve from source plugin capabilities instead of hardcoded MySQL/Postgres/MongoDB lists.
- Wired orchestrator tools through source plugins for:
  - listing supported connections
  - schema loading
  - query generation
  - query execution
  - dataset creation guards
  - temporary chart creation guards
- Updated orchestrator prompts, capability responses, and entity creation rules so supported sources come from registered plugins that declare `capabilities.ai.canGenerateQueries`.
- Added unit coverage verifying orchestrator connection listing includes plugin-supported sources and query generation uses source-owned AI hooks.

## Completed in Firestore migration slice

- Added the backend Firestore source plugin:
  - `server/sources/plugins/firestore/firestore.plugin.js`
  - `server/sources/plugins/firestore/firestore.protocol.js`
  - `server/sources/plugins/firestore/firestore.connection.js`
- Moved Firestore connection testing, data-request execution, builder metadata, and response configuration merging into the Firestore source protocol.
- Removed Firestore runtime/test/builder-metadata branches from:
  - `server/controllers/ConnectionController.js`
  - `server/controllers/DataRequestController.js`
  - `server/controllers/DatasetController.js`
- Moved Firestore frontend files and assets into a source-owned folder:
  - `client/src/sources/firestore/firestore.source.js`
  - `client/src/sources/firestore/firestore-connection-form.jsx`
  - `client/src/sources/firestore/firestore-builder.jsx`
  - `client/src/sources/firestore/assets/*`
- Updated registry and structure coverage for Firestore source lookup, runtime runner resolution, and source-owned files.

## Completed in RealtimeDB migration slice

- Added the backend RealtimeDB source plugin:
  - `server/sources/plugins/realtimedb/realtimedb.plugin.js`
  - `server/sources/plugins/realtimedb/realtimedb.protocol.js`
  - `server/sources/plugins/realtimedb/realtimedb.connection.js`
- Moved RealtimeDB connection testing, data-request execution, and builder metadata into the RealtimeDB source protocol.
- Removed RealtimeDB runtime/test/builder-metadata branches from:
  - `server/controllers/ConnectionController.js`
  - `server/controllers/DataRequestController.js`
  - `server/controllers/DatasetController.js`
- Removed the now-unused legacy Firebase token helper:
  - `server/modules/firebaseConnector.js`
- Moved RealtimeDB frontend files and assets into a source-owned folder:
  - `client/src/sources/realtimedb/realtimedb.source.js`
  - `client/src/sources/realtimedb/realtimedb-connection-form.jsx`
  - `client/src/sources/realtimedb/realtimedb-builder.jsx`
  - `client/src/sources/realtimedb/assets/*`
- Updated registry and structure coverage for RealtimeDB source lookup, runtime runner resolution, and source-owned files.

## Completed in Google Analytics migration slice

- Added the backend Google Analytics source plugin:
  - `server/sources/plugins/googleAnalytics/googleAnalytics.plugin.js`
  - `server/sources/plugins/googleAnalytics/googleAnalytics.protocol.js`
  - `server/sources/plugins/googleAnalytics/googleAnalytics.connection.js`
- Moved Google Analytics connection testing, data-request execution, and builder metadata into the Google Analytics source protocol.
- Removed Google Analytics runtime/test/builder-metadata branches from:
  - `server/controllers/ConnectionController.js`
  - `server/controllers/DataRequestController.js`
  - `server/controllers/DatasetController.js`
- Moved the legacy Google connector implementation out of `server/modules` and into the source-owned plugin folder.
- Updated Google OAuth routes and the legacy dashboard template builder to import the source-owned Google Analytics connector.
- Moved Google Analytics frontend files and assets into a source-owned folder:
  - `client/src/sources/googleAnalytics/googleAnalytics.source.js`
  - `client/src/sources/googleAnalytics/googleAnalytics-connection-form.jsx`
  - `client/src/sources/googleAnalytics/googleAnalytics-builder.jsx`
  - `client/src/sources/googleAnalytics/googleAnalytics-template.jsx`
  - `client/src/sources/googleAnalytics/googleAnalytics-api.js`
  - `client/src/sources/googleAnalytics/assets/*`
- Updated registry and structure coverage for Google Analytics source lookup, runtime runner resolution, builder metadata, and source-owned files.

## Completed in generic API migration slice

- Added the backend generic API source plugin:
  - `server/sources/plugins/api/api.plugin.js`
  - `id: "api"`
  - `type: "api"`
  - no plugin `subType`, so branded API sources without their own backend plugin can fall back to the shared API protocol by `type`
- Kept the generic API source, Stripe, and future branded API variants on the shared API protocol:
  - `server/sources/shared/protocols/api.protocol.js`
- Registered generic API runtime, preview, connection test, and builder metadata hooks through the source registry.
- Removed remaining generic API fallback runtime branches from:
  - `server/controllers/DataRequestController.js`
  - `server/controllers/DatasetController.js`
  - `server/controllers/ChartController.js`
- Moved generic API frontend source files and assets into a source-owned folder:
  - `client/src/sources/api/api.source.js`
  - `client/src/sources/api/api-connection-form.jsx`
  - `client/src/sources/api/api-builder.jsx`
  - `client/src/sources/api/api-pagination.jsx`
  - `client/src/sources/api/assets/*`
- Updated Stripe and Strapi frontend source wiring to keep using the source-owned generic API data-request builder.
- Updated registry, route, and structure coverage for generic API source lookup, non-migrated branded API fallback, runtime runner resolution, and `apiTest` preview routing.

## Completed in Strapi migration slice

- Added the backend Strapi source plugin:
  - `server/sources/plugins/strapi/strapi.plugin.js`
  - `id: "strapi"`
  - `dependsOn: ["api"]`
  - `type: "api"`
  - `subType: "strapi"`
- Kept Strapi on the shared API protocol for runtime execution, previews, connection tests, and builder metadata.
- Moved Strapi frontend source files and assets into a source-owned folder:
  - `client/src/sources/strapi/strapi.source.js`
  - `client/src/sources/strapi/strapi-connection-form.jsx`
  - `client/src/sources/strapi/assets/*`
- Updated registry and route coverage for Strapi source lookup, API protocol wiring, runtime runner resolution, and `apiTest` preview routing.

## Completed in source-plugin closeout cleanup

- Moved generic API test, preview, runtime data-request execution, and builder metadata ownership into:
  - `server/sources/shared/protocols/api.protocol.js`
- Kept `ConnectionController` API methods as thin compatibility wrappers for older route/controller callers.
- Removed the legacy frontend connection-logo compatibility map:
  - `client/src/config/connectionImages.js`
- Updated connection display logos to resolve only through the frontend source registry.
- Removed the stale AI/orchestrator next step because orchestrator source support now resolves from plugin capabilities.

## Completed in source-owned variable support slice

- Added a source-level variable dispatcher:
  - `server/sources/applySourceVariables.js`
- Added optional `backend.applyVariables(...)` validation to the source plugin contract.
- Moved runtime variable dispatch in `DataRequestController` and `DatasetController` from `Connection.type` switches to source plugin hooks.
- Added source-owned variable hooks for:
  - shared SQL sources and variants
  - MongoDB
  - ClickHouse
  - generic API, Stripe, and Strapi through the shared API source protocol
  - Firestore
  - RealtimeDB
  - Customer.io route variables
- Updated Firestore and RealtimeDB protocols to consume the processed data request supplied by the source runtime path instead of recursively calling the global variable dispatcher.
- Added unit coverage verifying source-owned variable hooks for SQL, Firestore, and Customer.io.

## Completed in MongoDB variable ownership cleanup

- Moved MongoDB variable substitution out of the global variable module and into:
  - `server/sources/plugins/mongodb/mongodb.protocol.js`
- Removed `applyMongoVariables(...)` from:
  - `server/modules/applyVariables.js`
- Kept MongoDB variable processing available through:
  - `source.backend.applyVariables(...)`
  - `mongodbProtocol.applyMongoVariables(...)`
- Updated agent docs to reference MongoDB's source-owned variable processor.

## Completed in remaining source-owned variable processors cleanup

- Moved the remaining concrete variable processors out of `server/modules/applyVariables.js` and into source-owned modules:
  - `server/sources/shared/sql/sql.variables.js`
  - `server/sources/shared/protocols/api.variables.js`
  - `server/sources/plugins/firestore/firestore.variables.js`
  - `server/sources/plugins/realtimedb/realtimedb.variables.js`
- Updated SQL, API, ClickHouse, Customer.io, Firestore, and RealtimeDB protocols to import their source-owned variable helpers directly.
- Reduced `server/modules/applyVariables.js` to a compatibility wrapper around `server/sources/applySourceVariables.js` plus legacy named exports.
- Removed the legacy fallback dependency from `server/sources/applySourceVariables.js`; unknown sources now return a no-op processed query shape.
- Added focused unit coverage for SQL, API, Firestore, and RealtimeDB variable processors.

## Verification completed

Passed:

```sh
cd server && npm run test:run -- tests/unit/sourceRegistry.test.js tests/unit/stripeConnectionOptions.test.js tests/unit/chartTemplateLoader.test.js tests/integration/chartTemplateRoute.test.js
cd server && npm run test:run -- tests/unit/sourceRegistry.test.js tests/integration/connectionRoute.security.test.js
cd server && npm run test:run -- tests/unit/sourceRegistry.test.js tests/integration/chartTemplateRoute.test.js tests/integration/connectionRoute.security.test.js
cd server && npm run test:run -- tests/unit/sourceRegistry.test.js tests/integration/connectionRoute.security.test.js tests/integration/chartTemplateRoute.test.js tests/unit/stripeConnectionOptions.test.js tests/unit/chartTemplateLoader.test.js
cd server && npm run test:run -- tests/unit/sourcePluginStructure.test.js tests/unit/sourceRegistry.test.js tests/integration/runtimeCache.test.js tests/integration/connectionRoute.security.test.js
cd server && npm run test:run -- tests/unit/chartTemplateLoader.test.js tests/integration/chartTemplateRoute.test.js
cd server && npm run test:run -- tests/unit/sqlProtocol.test.js tests/unit/sourceRegistry.test.js tests/unit/sourcePluginStructure.test.js tests/integration/runtimeCache.test.js
cd server && npm run test:run -- tests/unit/sourceRegistry.test.js tests/unit/sourcePluginStructure.test.js
cd client && npm run lint
cd server && npm run lint
cd client && npm run build
npm run test:run -- tests/unit/sourceRegistry.test.js tests/unit/sourcePluginStructure.test.js
npm run test:run -- tests/unit/sourceRegistry.test.js tests/unit/sourcePluginStructure.test.js tests/integration/connectionRoute.security.test.js # from server
npm run test:run -- tests/unit/sourceRegistry.test.js tests/unit/sourcePluginStructure.test.js tests/integration/connectionRoute.security.test.js # from server, after Strapi migration
npm run lint # from server
npm run lint # from client
npm run build # from client
npm run test:run -- tests/unit/sourceRegistry.test.js # from server, after source-owned variable support
npm run test:run -- tests/unit/sourceRegistry.test.js # from server, after MongoDB variable ownership cleanup
npm run test:run -- tests/unit/sourceVariableProcessors.test.js tests/unit/sourceRegistry.test.js tests/unit/sourcePluginStructure.test.js # from server, after remaining source-owned variable processors cleanup
npm run lint # from server, after remaining source-owned variable processors cleanup
```

Notes:

- `client` build completed successfully.
- Vite reported the existing large chunk warnings.
- No new lint errors were introduced.

## Important implementation notes

- Stripe still persists as `type: "api"` and `subType: "stripe"`.
- Stripe still delegates runtime data fetching to the existing API execution path.
- The public call sites now resolve source-owned metadata/defaults before falling back to generic API behavior.
- This keeps a future native Stripe protocol possible without making the UI/template code depend on `Connection.type === "api"`.
- The frontend registry currently contains all picker and dataset-builder sources, not only Stripe, because `ConnectionWizard` and `DatasetQuery` need one source of truth for components.
- Frontend source definitions were split from component wiring so shared defaults can be imported by builders without circular imports.
- The backend registry currently contains generic API, Strapi, Stripe, Customer.io, MongoDB, ClickHouse, Firestore, RealtimeDB, Postgres, TimescaleDB, Supabase DB, RDS Postgres, MySQL, and RDS MySQL.
- Stripe and Customer.io saved/unsaved connection tests now resolve through the source plugin first.
- Stripe and Customer.io runtime data-request execution now resolves through the source plugin first.
- Stripe delegates runtime data fetching, previews, connection tests, and builder metadata to the shared API source protocol. This is intentional because Stripe has no custom behavior beyond branded defaults/templates right now.
- Source variable processing now resolves through `server/sources/applySourceVariables.js` and source-owned `backend.applyVariables(...)` hooks.
- MongoDB variable substitution is fully source-owned in `server/sources/plugins/mongodb/mongodb.protocol.js`.
- SQL variable substitution is source-owned in `server/sources/shared/sql/sql.variables.js`.
- API variable substitution is source-owned in `server/sources/shared/protocols/api.variables.js`.
- Firestore variable substitution is source-owned in `server/sources/plugins/firestore/firestore.variables.js`.
- RealtimeDB variable substitution is source-owned in `server/sources/plugins/realtimedb/realtimedb.variables.js`.
- Replacing Stripe with a native protocol later should only require changing the Stripe plugin protocol wiring.
- Customer.io runtime/test implementation is source-owned in `server/sources/plugins/customerio/customerio.protocol.js`.
- Customer.io API implementation details are source-owned in `server/sources/plugins/customerio/customerio.connection.js`.
- There is no active Customer.io helper route in the backend. Current Customer.io builder components use the source-action endpoint.
- Connection display logos now resolve through the source registry.
- Postgres runtime/test/schema behavior is source-owned in `server/sources/plugins/postgres/postgres.protocol.js`.
- Postgres now depends on the shared SQL source runtime instead of duplicating generic SQL connection/query/cache/audit code.
- MySQL runtime/test/schema behavior is source-owned in `server/sources/plugins/mysql/mysql.protocol.js`.
- MongoDB runtime/test/schema/query-preview behavior is source-owned in `server/sources/plugins/mongodb/mongodb.protocol.js`.
- ClickHouse runtime/test/schema/query-preview behavior is source-owned in `server/sources/plugins/clickhouse/clickhouse.protocol.js`.
- Firestore runtime/test/builder-metadata behavior is source-owned in `server/sources/plugins/firestore/firestore.protocol.js`.
- RealtimeDB runtime/test/builder-metadata behavior is source-owned in `server/sources/plugins/realtimedb/realtimedb.protocol.js`.
- RDS MySQL is a separate source plugin in `server/sources/plugins/rdsmysql` and depends on MySQL.
- TimescaleDB, Supabase DB, and RDS Postgres are separate source plugins and depend on Postgres.
- The legacy `server/modules/externalDbConnection.js` module has been removed. SQL connection handling now lives under `server/sources/shared/sql`.
- Keep SQL variants as separate plugins when they may need their own templates, defaults, AI harness, or UI, even if they delegate to the Postgres/shared SQL runtime.

## Next steps

1. Consider removing legacy named exports from `server/modules/applyVariables.js` after confirming no external or older non-source call sites import them.
2. Continue adding focused source-owned variable tests when new sources or variable-capable fields are added.
