# Source plugin guide

Use this checklist when adding, migrating, or changing a Chartbrew source.

Related docs:

- [`chartbrew-source-plugin-initial-spec.md`](./chartbrew-source-plugin-initial-spec.md)
- [`chartbrew-source-plugin-progress.md`](./chartbrew-source-plugin-progress.md)

## Core rules

- Keep source-specific runtime, UI, templates, and AI behavior owned by the source plugin.
- Prefer registry/capability checks over `connection.type` and `connection.subType` branches.
- Migrate one source at a time and remove old branches for that source in the same change.
- Keep backend availability separate from frontend creation availability.
- Reuse shared protocols only when behavior is genuinely shared.
- Do not add helper routes, compatibility thunks, or controller branches unless an active caller still needs them.

## Source identity

Each source has a registry identity plus persisted connection identity:

```js
{
  id: "stripe",
  type: "api",
  subType: "stripe",
}
```

- `id`: registry key for UI, templates, source lookup, and tests.
- `type`: persisted execution family, such as `api`, `postgres`, `mongodb`, or `customerio`.
- `subType`: persisted brand/variant when needed.
- Plain sources can use the same value for all three.
- Branded API sources should use `type: "api"` and their brand as `subType`.
- Variants should declare `dependsOn: ["<sourceId>"]`.

## Availability

Use an optional `availability` block:

```js
availability: {
  server: { enabled: true },
  ui: { canCreateConnections: true },
}
```

- Server disabling uses `CB_DISABLED_SERVER_SOURCES`.
- UI creation disabling uses `VITE_DISABLED_UI_SOURCES`.
- Do not remove disabled sources from the registry; existing connections still need metadata, logos, builders, and clear errors.
- Enforce server disabling before hooks that can call a source: connection tests, previews, `runDataRequest`, metadata/schema loading, actions, and AI tools.
- UI disabling should only hide new-connection creation. Existing edit/build flows must still resolve the source.

## File layout

Backend:

```txt
server/sources/plugins/<source>/<source>.plugin.js
server/sources/plugins/<source>/<source>.protocol.js
server/sources/plugins/<source>/<source>.connection.js
server/sources/plugins/<source>/ai/<source>.ai.js
server/sources/plugins/<source>/templates/
server/sources/shared/<shared-helper>.js
```

Frontend:

```txt
client/src/sources/<source>/<source>.source.js
client/src/sources/<source>/<source>-connection-form.jsx
client/src/sources/<source>/<source>-builder.jsx
client/src/sources/<source>/<source>-resource-query.jsx
client/src/sources/<source>/<source>-template-setup.jsx
client/src/sources/<source>/assets/
```

Use source-prefixed filenames. Keep React component names PascalCase inside files.

## Backend checklist

### 1. Create the plugin

Add `server/sources/plugins/<sourceId>/<sourceId>.plugin.js`:

```js
const protocol = require("./<sourceId>.protocol");

module.exports = {
  id: "<sourceId>",
  dependsOn: [],
  type: "<connectionType>",
  subType: "<connectionSubType>",
  name: "<Display name>",
  category: "<category>",
  description: "<short description>",
  capabilities: {
    connection: {
      supportsTest: true,
      supportsOAuth: false,
      supportsFiles: false,
      authModes: [],
    },
    data: {
      supportsQuery: false,
      supportsSchema: false,
      supportsResourcePicker: false,
      supportsPagination: false,
      supportsVariables: true,
      supportsJoins: true,
    },
    templates: {
      datasets: false,
      charts: false,
      dashboards: false,
    },
    ai: {
      canGenerateDatasets: false,
      canGenerateQueries: false,
      hasSourceInstructions: false,
      hasTools: false,
    },
  },
  backend: {
    ...protocol,
  },
};
```

Examples:

- Branded shared API: `server/sources/plugins/stripe/stripe.plugin.js`
- Custom protocol: `server/sources/plugins/customerio/customerio.plugin.js`
- Shared SQL wrapper: `server/sources/plugins/postgres/postgres.protocol.js`

### 2. Register it

Update `server/sources/index.js`.

The registry provides:

- `getSourceById(id)`
- `getSourceForConnection(connection)`
- `findSourceForConnection(connection)`
- `getSourceSummaries()`

### 3. Add protocol behavior

Implement only what the source needs:

- `testConnection({ connection })`
- `testUnsavedConnection({ connection, extras })`
- `prepareConnectionData({ connection, extras })`
- `runDataRequest({ connection, dataRequest, chartId, getCache, filters, timezone, variables, auditContext })`
- `previewDataRequest({ connection, dataRequest, itemsLimit, items, offset, pagination, paginationField })`
- `getBuilderMetadata({ connection, dataRequest, options })`
- `getSchema({ connection, dataRequest })`
- `applyVariables({ dataRequest, variables })`
- `actions`

Rules:

- Keep custom runtime behavior in source-owned files, not controllers.
- `prepareConnectionData(...)` may enrich connection payloads before save; catch best-effort failures and return the original connection.
- Variable substitution is source-owned through `backend.applyVariables(...)`; the dispatcher is `server/sources/applySourceVariables.js`.
- Branded API sources can reuse `server/sources/shared/protocols/api.protocol.js`.
- SQL variants can reuse `server/sources/shared/sql/sql.protocol.js`, but still keep source-owned wrappers for source identity, defaults, AI, templates, and variants.

### 4. Add actions only when needed

Expose source-specific helper calls as plugin actions:

```js
const actions = {
  getAllSegments({ connection }) {
    return sourceImplementation.getAllSegments(connection);
  },
};

module.exports = {
  capabilities: {
    actions: Object.keys(actions),
  },
  backend: {
    ...protocol,
    actions,
  },
};
```

Actions are called through:

```txt
POST /team/:team_id/connections/:connection_id/source-action
```

Do not add new `/helper/:method` routes.

### 5. Route runtime through the registry

Runtime execution should resolve the source from:

```txt
server/sources/runSourceDataRequest.js
```

Callers:

- `server/controllers/DataRequestController.js`
- `server/controllers/DatasetController.js`

When migrating a source, route it through `source.backend.runDataRequest(...)` and remove old fallback branches.

### 6. Route tests/previews through the plugin

Source-aware connection routes live in:

```txt
server/api/ConnectionRoute.js
```

These paths should use plugin methods:

- `GET /team/:team_id/connections/:connection_id/test`
- `POST /team/:team_id/connections/:type/test`
- `POST /team/:team_id/connections/:type/test/files`
- `POST /team/:team_id/connections/:connection_id/apiTest`
- `POST /team/:team_id/connections/:connection_id/source-action`

### 7. Add backend tests

Update or add:

```txt
server/tests/unit/sourceRegistry.test.js
server/tests/integration/connectionRoute.security.test.js
```

Minimum checks:

- resolves by `id`
- resolves from persisted connection shape
- exposes expected backend methods
- runtime dispatcher finds the migrated source
- unlisted actions are rejected
- project-scoped users cannot access restricted source actions
- preview/test routes call plugin hooks

## Frontend checklist

### 1. Add source metadata

Create:

```txt
client/src/sources/<source>/<source>.source.js
client/src/sources/<source>/assets/
```

Keep `*.source.js` free of React imports.

Typical shape:

```js
{
  id: "<sourceId>",
  type: "<connectionType>",
  subType: "<connectionSubType>",
  name: "<Display name>",
  category: "<category>",
  availability: {
    ui: { canCreateConnections: true },
  },
  capabilities: {
    ai: { canGenerateQueries: false },
    templates: { charts: false },
    nextSteps: { chartTemplates: false },
  },
  assets: {
    lightLogo,
    darkLogo,
  },
}
```

### 2. Wire components

Update `client/src/sources/index.js`:

```js
import ConnectionForm from "./<source>/<source>-connection-form";
import DataRequestBuilder from "./<source>/<source>-builder";
import ChartTemplateSetup from "./<source>/<source>-template-setup";

const FRONTEND_BY_SOURCE_ID = {
  <sourceId>: {
    ConnectionForm,
    DataRequestBuilder,
    ChartTemplateSetup,
  },
};
```

Rules:

- Do not add source-specific form/builder branches to shared screens.
- Keep custom template setup UI under `client/src/sources/<source>/`.
- UI-disabled sources should be hidden only from creation; existing edit/builder flows still resolve by registry.

### 3. Use source actions

Use `runSourceAction(...)` from `client/src/slices/connection.js`.

Do not add `runHelperMethod` thunks or helper routes.

### 4. Use registry logos

- Connection display: `client/src/modules/getConnectionLogo.js`
- Source picker cards: `getSourceLogo(source, isDark)`

## Template checklist

If the source ships built-in chart templates:

1. Put files under `server/sources/plugins/<sourceId>/templates/`.
2. Add backend template metadata:

   ```js
   const path = require("path");

   templates: {
     directory: path.join(__dirname, "templates"),
     chartTemplates: ["template-id"],
     defaults: {
       dataRequest: DEFAULT_DATA_REQUEST,
     },
   }
   ```

3. Add frontend template metadata:

   ```js
   capabilities: {
     templates: { charts: true },
     nextSteps: { chartTemplates: true },
   },
   templates: {
     chartTemplates: ["template-id"],
   },
   defaults: {
     dataRequest: {},
   },
   ```

4. Custom setup UI goes in `client/src/sources/<sourceId>/<sourceId>-template-setup.jsx`.
5. Built-in templates must resolve through registered source plugins.

Template chart bindings:

```js
{
  id: "revenue-vs-fees",
  requiredDatasetIds: ["gross_revenue", "fees"],
  cdcs: [{
    datasetTemplateId: "gross_revenue",
    xAxis: "root[].period",
    yAxis: "root[].value",
    legend: "Gross revenue",
  }],
}
```

Use `layoutIntent` instead of hard-coded grid coordinates:

```js
{
  id: "net-revenue-kpi",
  layoutIntent: {
    kind: "kpi",
    priority: 10,
  },
}
```

Supported kinds: `kpi`, `trend`, `comparison`, `table`.

## AI/orchestrator checklist

Pick exactly one runtime AI mode.

### Query-generation mode

Use for SQL-like or Mongo-like sources where Chartbrew generates a read-only query over a schema.

Capabilities:

```js
ai: {
  canGenerateDatasets: true,
  canGenerateQueries: true,
  hasSourceInstructions: true,
  hasTools: false,
}
```

Backend wiring:

```js
backend: {
  ...protocol,
  ai: {
    getCapabilities: () => getQueryGenerationCapabilities("<sourceId>"),
    getSchema: protocol.getSchema,
    generateQuery: protocol.generateQuery,
    instructions: getQueryGenerationInstructions("<sourceId>"),
  },
}
```

Rules:

- Put compact dialect hints in `server/sources/shared/ai/queryGenerationInstructions.js`.
- Keep hints short: read-only, dialect syntax, date bucketing, limits, variables, caveats.
- `get_schema` returns `sourceInstructions`.
- `generate_query` injects `sourceInstructions` into the schema sent to `backend.ai.generateQuery(...)`.
- Do not expose source-owned `planDataset`.

### Source-owned configuration mode

Use for sources where Chartbrew plans configuration, routes, paths, or API request options instead of free-form queries.

Capabilities:

```js
ai: {
  canGenerateDatasets: true,
  canGenerateQueries: false,
  hasSourceInstructions: true,
  hasTools: true,
}
```

Backend wiring:

```js
const sourceAi = require("./ai/<sourceId>.ai");

backend: {
  ...protocol,
  ai: sourceAi,
}
```

AI module path:

```txt
server/sources/plugins/<sourceId>/ai/<sourceId>.ai.js
```

Implement only needed methods:

- `getCapabilities({ connection })`
- `listResources({ connection })`
- `getSchema({ connection })`
- `getSampleData({ connection, resource, rowLimit })`
- `planDataset({ connection, question, overrides })`
- `validateConfiguration(configuration, { connection })`
- `previewConfiguration({ connection, configuration, rowLimit })`
- `listTemplates({ connection })`
- `recommendTemplates({ connection, question })`

Rules:

- Use generic orchestrator tools from `server/modules/ai/orchestrator/tools/sourceTools.js`.
- Do not add per-source top-level orchestrator tools.
- Do not expose `generateQuery`.
- Keep outputs compact, capped, and secret-free.
- Do not return raw docs, auth headers, bearer tokens, OAuth tokens, or large schemas.
- Generic API sources can use free-form AI Context; only recognizable provider hosts may allow model/provider fallback.

Planner statuses:

- `ok`: include source DataRequest fields and `chartSpec`
- `needs_more_context`: include `message`, `requiredContext`, and optional edit/context guidance
- `needs_disambiguation`: include compact `options`
- `needs_model_planning`: only for generic API/provider fallback
- `unsupported` or `error`: include actionable `message` or `errors`

### Chart binding contract

AI-created charts must persist safe ChartDatasetConfigs:

- Table: planner may omit `xAxis` only if creation defaults it to `root[]`.
- KPI/avg/gauge: require `yAxis`; missing `xAxis` must fall back to `yAxis`.
- Line/bar/pie/doughnut/radar/polar: require both `xAxis` and `yAxis`.
- Timeseries: provide date-compatible `xAxis` or `dateField` when date filtering is expected.

Normalize or reject unsafe chart payloads before rendering.

### Harness expectations

When AI behavior changes, update:

```txt
server/tests/unit/sourceAiHarness.test.js
```

The harness is deterministic and must not call the LLM. It should check:

- planner statuses, DataRequest shape, and chart specs
- query-generation instructions through `get_schema` and `generate_query`
- source-owned sources do not expose `generateQuery`
- query-generation sources do not expose `planDataset`
- generic `source_*` outputs are compact, capped, and secret-free
- temporary and saved charts persist safe CDC bindings
- high-risk tool sequences stay in the intended mode

Keep fixtures small and invariant-focused. Add source-specific examples only for domain rules generic assertions cannot express.

## Cleanup checklist

Search for old source branches:

```sh
rg "<sourceId>|<Connection.type>|<Connection.subType>" server/controllers server/api client/src
```

Remove migrated-source branches from:

- `ConnectionController`
- `DataRequestController`
- `DatasetController`
- route-specific helper endpoints
- frontend builder/form switch statements
- one-off logo maps

Generic protocol files may still mention protocol names.

## Verification checklist

Run the relevant focused checks:

```sh
cd server && npm run test:run -- tests/unit/sourceRegistry.test.js tests/integration/connectionRoute.security.test.js
cd server && npm run test:run -- tests/unit/sourceAiHarness.test.js
cd server && npm run lint
cd client && npm run lint
cd client && npm run build
```

Add source-specific focused tests when templates, protocol behavior, schema loading, frontend flows, or AI behavior are touched.
