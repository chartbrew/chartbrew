# Source plugin guide

This guide is the implementation checklist for adding or migrating a Chartbrew source in `chartbrew-os`.

Use it together with:

- [`chartbrew-source-plugin-initial-spec.md`](./chartbrew-source-plugin-initial-spec.md)
- [`chartbrew-source-plugin-progress.md`](./chartbrew-source-plugin-progress.md)

## Principles

- Keep source-specific implementation with the source plugin.
- Prefer registry and capability checks over `connection.type` or `connection.subType` branches.
- Keep server runtime availability separate from frontend creation availability.
- Migrate one source at a time, but remove old branches for that migrated source in the same change.
- Do not keep legacy helper routes, compatibility thunks, or controller branches unless an active UI or API caller still needs them.
- Branded API sources can use the shared API protocol when they do not need custom behavior. Do not create a native protocol just to wrap the API protocol.

## Source identity

Every source needs a stable plugin `id`, plus the persisted connection identity:

```js
{
  id: "stripe",
  type: "api",
  subType: "stripe",
}
```

Rules:

- `id` is the source registry key used by UI, templates, and plugin lookup.
- `type` is the persisted execution family, such as `api`, `postgres`, `mongodb`, or `customerio`.
- `subType` is the persisted brand or variant when needed.
- For plain protocol sources, `id`, `type`, and `subType` can all match.
- For branded API sources, keep `type: "api"` and use `subType` for the brand.
- For variants that depend on an existing source plugin, add `dependsOn: ["<sourceId>"]`.

## Source availability

Source disabling has two independent axes:

- Backend/server disabling means Chartbrew must not make outbound requests to the source.
- Frontend/UI disabling means users cannot create new connections for the source from the UI.

Model this with an optional availability block:

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

Omitted values should default to enabled/creatable.

Server runtime overrides use `CB_DISABLED_SERVER_SOURCES`. Frontend creation overrides use `VITE_DISABLED_UI_SOURCES` because the client is built with Vite.

Do not remove disabled sources from the registry. Existing connections still need to resolve to their source metadata so Chartbrew can render names, logos, edit screens, builders, and clear disabled-source errors.

Server-side disabling must be enforced before every hook that can call the external source:

- `prepareConnectionData`
- `testConnection`
- `testUnsavedConnection`
- `previewDataRequest`
- `runDataRequest`
- `getBuilderMetadata` when it loads remote metadata
- `getSchema`
- `actions`
- AI/orchestrator source tools

UI-side disabling should only filter creation surfaces. Use a creatable-source list for the connection picker, but keep `getSourcePlugin(id)` and `getSourceForConnection(connection)` able to return UI-disabled sources for existing connections.

## File naming

Use source-prefixed filenames so source files are easy to find.

Backend source files use dot-separated role names:

```txt
server/sources/plugins/<source>/<source>.plugin.js
server/sources/plugins/<source>/<source>.protocol.js
server/sources/plugins/<source>/<source>.connection.js
server/sources/shared/<shared-helper>.js
```

Frontend source UI files use lowercase kebab-case:

```txt
client/src/sources/<source>/<source>-connection-form.jsx
client/src/sources/<source>/<source>-builder.jsx
client/src/sources/<source>/<source>-resource-query.jsx
client/src/sources/<source>/<source>-template-setup.jsx
client/src/sources/shared/<shared-ui>/
```

Keep React component names PascalCase inside the files. The filename is for navigation; the exported component name should stay idiomatic React.

## Backend checklist

### 1. Create the source plugin

Add a file:

```txt
server/sources/plugins/<sourceId>/<sourceId>.plugin.js
```

The plugin should export source metadata, capabilities, backend behavior, and optional template metadata:

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

Use Stripe as the branded API example:

- `server/sources/plugins/stripe/stripe.plugin.js`
- `server/sources/shared/protocols/api.protocol.js`

Use Customer.io as the custom protocol example:

- `server/sources/plugins/customerio/customerio.plugin.js`
- `server/sources/plugins/customerio/customerio.protocol.js`
- `server/sources/plugins/customerio/customerio.connection.js`

### 2. Register the plugin

Update:

```txt
server/sources/index.js
```

Import the plugin and add it to the `sources` array. The registry validates required fields and exposes:

- `getSourceById(id)`
- `getSourceForConnection(connection)`
- `findSourceForConnection(connection)`
- `getSourceSummaries()`

If a source can be disabled at runtime, add the availability override near the registry/config layer and enforce it from shared source execution wrappers. Do not make each controller remember the same disabled-source check.

### 3. Add or reuse a protocol module

Source-specific protocol modules live inside the source plugin folder:

```txt
server/sources/plugins/<sourceId>/
```

A backend protocol can implement:

- `testConnection({ connection })`
- `testUnsavedConnection({ connection, extras })`
- `prepareConnectionData({ connection, extras })`
- `runDataRequest({ connection, dataRequest, chartId, getCache, filters, timezone, variables, auditContext })`
- `previewDataRequest({ connection, dataRequest, itemsLimit, items, offset, pagination, paginationField })`
- `getBuilderMetadata({ connection, dataRequest, options })`
- `getSchema({ connection, dataRequest })`
- `applyVariables({ dataRequest, variables })`
- `ai.generateQuery({ schema, question, conversationHistory, currentQuery, connection, dataRequest })`
- `actions`

Only implement what the source needs.

`prepareConnectionData(...)` runs before `ConnectionController.create(...)` in `server/api/ConnectionRoute.js`. Use it for source-owned create-time enrichment, such as loading a SQL schema before the connection is persisted. It should return the connection payload to persist. If enrichment is best-effort, catch source errors and return the original connection object so users can still save and test manually.

If the source has custom runtime behavior, keep it in `server/sources/plugins/<source>/<source>.protocol.js` or a sibling source-owned implementation file. Do not add new custom source methods to `ConnectionController`.

Variable substitution is source-owned. The public dispatcher is `server/sources/applySourceVariables.js`, which resolves `backend.applyVariables(...)` from the source registry. Keep concrete substitution logic beside the protocol, such as `server/sources/shared/sql/sql.variables.js`, `server/sources/shared/protocols/api.variables.js`, or `server/sources/plugins/<source>/<source>.variables.js`. `server/modules/applyVariables.js` is only a compatibility wrapper for older imports.

If the source only brands the API connector, reuse `server/sources/shared/protocols/api.protocol.js`.

SQL sources can reuse the shared SQL runtime without giving up source ownership:

```txt
server/sources/shared/sql/externalDbConnection.js
server/sources/shared/sql/sql.protocol.js
```

The source plugin should still keep a source-owned protocol wrapper, for example:

```txt
server/sources/plugins/postgres/postgres.protocol.js
server/sources/plugins/mysql/mysql.protocol.js
```

That wrapper should pass source-specific details such as `connectionType`, AI behavior, defaults, templates, and variant handling into the shared SQL helpers. Keep variants as separate plugins when they can have different templates, AI harnesses, setup defaults, or UI behavior. For example, a future TimescaleDB plugin should declare `dependsOn: ["postgres"]` and depend on the Postgres/shared SQL behavior from its own plugin wrapper instead of being folded into a generic shared branch.

### 4. Move source-specific actions

For source-specific UI helper calls, expose actions from the plugin:

```js
const actions = {
  getAllSegments({ connection }) {
    return sourceImplementation.getAllSegments(connection);
  },
};

module.exports = {
  // ...
  capabilities: {
    // ...
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

Do not add new routes like `/helper/:method`. The route already:

- verifies token
- checks connection permissions
- resolves the source from the connection
- rejects actions not exposed by the plugin

### 5. Route backend execution through the registry

Migrate runtime dispatch by asking the registry first.

Current runtime dispatcher:

```txt
server/sources/runSourceDataRequest.js
```

Current callers:

- `server/controllers/DataRequestController.js`
- `server/controllers/DatasetController.js`

When migrating a source, make sure the source is handled by `source.backend.runDataRequest(...)` and remove any old fallback branch for that same source.

### 6. Route connection tests and previews through the plugin

Current route:

```txt
server/api/ConnectionRoute.js
```

The following paths should resolve migrated sources through plugin methods first:

- `GET /team/:team_id/connections/:connection_id/test`
- `POST /team/:team_id/connections/:type/test`
- `POST /team/:team_id/connections/:type/test/files`
- `POST /team/:team_id/connections/:connection_id/apiTest`
- `POST /team/:team_id/connections/:connection_id/source-action`

For branded API sources such as Stripe, `apiTest` should call `source.backend.previewDataRequest(...)` through the shared API protocol.

### 7. Move implementation ownership

When migrating a source, move source-specific runtime code out of shared controllers and into source-owned files.

Good:

```txt
server/sources/plugins/customerio/customerio.protocol.js
server/sources/plugins/customerio/customerio.connection.js
```

Avoid:

```txt
server/controllers/ConnectionController.js -> runCustomerio()
server/controllers/ConnectionController.js -> testCustomerio()
server/api/ConnectionRoute.js -> /helper/:method
```

Shared runtime utilities can live outside the source if they are genuinely reusable. Existing example:

```txt
server/sources/shared/connectorRuntime.js
```

### 8. Add backend tests

Update or add tests in:

```txt
server/tests/unit/sourceRegistry.test.js
server/tests/integration/connectionRoute.security.test.js
```

Minimum coverage for a migrated source:

- registry resolves by `id`
- registry resolves from persisted connection shape
- source exposes expected backend methods
- runtime dispatcher returns a runner for migrated sources
- protected source actions reject unlisted actions
- project-scoped users cannot call source actions on restricted connections
- API preview/test routes use plugin hooks for migrated API sources

Run focused verification:

```sh
cd server && npm run test:run -- tests/unit/sourceRegistry.test.js tests/integration/connectionRoute.security.test.js
cd server && npm run lint
```

## Frontend checklist

### 1. Add source definition metadata

Create source-local metadata:

```txt
client/src/sources/<source>/<source>.source.js
client/src/sources/<source>/assets/
```

Add the source metadata, capabilities, assets, defaults, and templates:

```js
{
  id: "<sourceId>",
  type: "<connectionType>",
  subType: "<connectionSubType>",
  name: "<Display name>",
  category: "<category>",
  availability: {
    ui: {
      canCreateConnections: true,
    },
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

Keep `*.source.js` free of React component imports. Builders can import metadata/defaults without pulling in UI components. `client/src/sources/definitions.js` is only the temporary legacy bridge for sources that have not been moved into source-local modules yet.

### 2. Wire frontend components

Update:

```txt
client/src/sources/index.js
```

Add source-specific components:

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

Current registry-driven screens:

- `client/src/containers/Connections/ConnectionWizard.jsx`
- `client/src/containers/Connections/ConnectionNextSteps.jsx`
- `client/src/containers/Dataset/DatasetQuery.jsx`
- `client/src/containers/AddChart/components/DatarequestModal.jsx`

Do not add new explicit form or builder branches to those screens.
Do not import source-specific template setup components into shared connection screens.
When a source needs custom chart-template onboarding, keep that React component under `client/src/sources/<source>/` and expose it as `frontend.ChartTemplateSetup` from `client/src/sources/index.js`.

For UI-disabled sources, filter only the new-connection picker. Existing connection edit and data-request builder flows should still resolve the source plugin by id or persisted connection shape.

### 3. Use source actions from UI

Use:

```js
runSourceAction({
  team_id,
  connection_id,
  action,
  params,
})
```

from:

```txt
client/src/slices/connection.js
```

Do not add new `runHelperMethod` thunks or route calls.

### 4. Use registry-first logos

For connection display logos, use:

```txt
client/src/modules/getConnectionLogo.js
```

This resolves logos from the source registry.

For source picker cards where the source object is already available, `getSourceLogo(source, isDark)` is fine.

### 5. Add or update frontend verification

Run:

```sh
cd client && npm run lint
cd client && npm run build
```

If you changed screens materially, test the relevant flow in the browser:

- connection creation
- connection edit
- dataset request builder opening existing requests
- data-request preview/run
- any source action dropdowns or resource pickers

## Template checklist

If the source ships built-in chart templates:

1. Add template files under:

   ```txt
   server/sources/plugins/<sourceId>/templates/
   ```

2. Add template metadata to the backend plugin:

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

3. Add frontend source metadata:

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

4. If the source needs a custom setup UI for choosing or grouping chart templates, add it under:

   ```txt
   client/src/sources/<sourceId>/<sourceId>-template-setup.jsx
   ```

   Then expose it through `frontend.ChartTemplateSetup` in `client/src/sources/index.js`. Shared screens should only ask the source registry for this component.

5. Ensure `ChartTemplateController` and `server/sources/shared/templates/chartTemplateLoader.js` resolve built-in templates through registered source plugins, not through standalone source folders or controller-local constants.

Template charts can bind one dataset with `cdc` or multiple datasets with `cdcs`:

```js
{
  id: "revenue-vs-fees",
  requiredDatasetIds: ["gross_revenue", "fees"],
  cdcs: [{
    datasetTemplateId: "gross_revenue",
    xAxis: "root[].period",
    yAxis: "root[].value",
    legend: "Gross revenue",
  }, {
    datasetTemplateId: "fees",
    xAxis: "root[].period",
    yAxis: "root[].value",
    legend: "Fees",
  }],
}
```

Use `layoutIntent` for template-owned dashboard placement. Do not hard-code React Grid Layout coordinates in template JSON unless there is a source-specific reason that cannot be expressed with an intent. `ChartTemplateController` calculates concrete breakpoint layouts from the selected chart set and the existing dashboard charts.

```js
{
  id: "net-revenue-kpi",
  layoutIntent: {
    kind: "kpi",
    priority: 10,
  },
}
```

Supported layout intent kinds are `kpi`, `trend`, `comparison`, and `table`. Lower `priority` values are placed first. Put Chartbrew-supported chart options under `chart`, such as `mode`, `showGrowth`, `invertGrowth`, `pointRadius`, `xLabelTicks`, `defaultRowsPerPage`, `timeInterval`, and `includeZeros`.

## AI/orchestrator checklist

Do this after the source has backend runtime support.

For simple query generation, expose the source hook on the backend plugin:

```js
backend: {
  ...protocol,
  ai: {
    getSchema: protocol.getSchema,
    generateQuery: protocol.generateQuery,
  },
}
```

`DataRequestController.askAi(...)` resolves `backend.ai.generateQuery(...)` before falling back to the legacy SQL/MongoDB/ClickHouse switch. A source with `capabilities.ai.canGenerateQueries: true` must provide `backend.ai.generateQuery(...)`.

Move hardcoded supported-source lists toward source capabilities in:

- `server/modules/ai/orchestrator/entityCreationRules.js`
- `server/modules/ai/orchestrator/tools/listConnections.js`
- `server/modules/ai/orchestrator/tools/getSchema.js`
- `server/modules/ai/orchestrator/orchestrator.js`

For query-generating sources, add source capabilities first, then route AI behavior from those capabilities.

## Cleanup checklist

Before considering a source migrated, search for old source-specific branches:

```sh
rg "<sourceId>|<Connection.type>|<Connection.subType>" server/controllers server/api client/src
```

Remove migrated-source branches from:

- `ConnectionController`
- `DataRequestController`
- `DatasetController`
- route-specific helper endpoints
- frontend builder/form switch statements
- one-off logo maps at display call sites

It is acceptable for generic protocol code to mention protocol names. For example, the shared API protocol can remain API-specific, and `paginateRequests.js` can keep template-specific pagination behavior until that is deliberately migrated.

## Verification checklist

Run at minimum:

```sh
cd server && npm run test:run -- tests/unit/sourceRegistry.test.js tests/integration/connectionRoute.security.test.js
cd server && npm run lint
cd client && npm run lint
cd client && npm run build
```

Add source-specific focused tests when templates, protocol behavior, schema loading, or AI behavior are touched.
