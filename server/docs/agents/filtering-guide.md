# Filtering Guide

This guide documents how runtime filtering works across the dashboard surfaces after the consolidation pass.

## Core Rule

Every chart refresh is built from a single effective runtime payload:

- `variables`: dashboard variable filters with non-empty values
- `filters`: normalized non-variable filters from both dashboard filters and chart-local exposed filters

The runtime payload is assembled on the client, sent to the server once, normalized again on the server, and then applied consistently during source querying and post-query chart parsing.

## Filter Sources

### 1. Dashboard Variable Filters

- Defined in dashboard filter UI
- Stored in dashboard filter state / localStorage for authenticated dashboards
- Sent only through `variables`
- Runtime values override dataset/query defaults
- Clearing a variable removes it from the runtime payload, which makes the backend fall back to the saved default binding value

### 2. Dashboard Field Filters

- Defined in dashboard filter UI as matching-field filters
- Sent through `filters`
- Scope is chart-wide
- Applied with AND semantics against any chart-local filters

### 3. Dashboard Date Range Filters

- Defined in dashboard filter UI as date filters
- Sent through `filters`
- Only active for charts included in the filter’s `charts` list
- Intersected with the chart’s configured date window instead of overriding it
- Also combine with chart-local exposed date filters using AND semantics

### 4. Chart-Local Exposed Filters

- Defined by exposed CDC conditions on a chart
- Stored only in page/session state for phase 1
- Sent through `filters`
- Tagged with `cdcId` and `scope: "cdc"`
- Only affect the originating CDC/dataset, even when sibling datasets share the same field name

## Client Entry Points

### Private Dashboards

- `client/src/containers/ProjectDashboard/ProjectDashboard.jsx`
- Owns both dashboard filter state and per-chart exposed filter state
- Loads configuration first with `GET /project/:id?view=configuration`.
- `useDashboardChartData` observes widgets within 200px of the viewport and queues up to four charts per batch, with at most two batches in flight.
- `POST /project/:project_id/chart/batch` receives each chart's effective `filters` and `variables`. Initial loading and filter changes share this path; there is no preceding unfiltered data request.
- Unfiltered reads use saved prepared results without triggering source refreshes. If a chart has datasets but no usable saved result, one shared in-flight operation computes the result, allowing source cache reads. Charts with no datasets retain their existing empty state.
- Filtered reads use the runtime cache first and compute a result on a miss. The normal runtime cache rules for stale results apply.
- Filter changes and navigation abort obsolete client requests. Request IDs prevent late batch responses from replacing newer results.
- HTTP 429 responses pause batch requests according to `Retry-After`, with three attempts in total. The API exposes this header through CORS. Failed charts keep a retry action.
- The authenticated batch endpoint checks dashboard access and all requested chart IDs, including draft visibility, before loading any results. Public dashboards and reports use the same client queue with their public batch endpoints.
- Uses `client/src/modules/chartRuntimeFilters.js` to build one payload per chart

### Public Dashboards / Reports

- `client/src/containers/PublicDashboard/PublicDashboard.jsx`
- `client/src/containers/PublicDashboard/Report.jsx`
- Use the same runtime payload builder and viewport batch queue as the private dashboard.
- Fetch configuration with `view=configuration`, then use `/project/dashboard/:brewName/charts` or `/project/:brewName/report/charts`.
- `publicDashboardAccess` validates member scope, internal snapshot credentials, public visibility, share-token entity/policy/expiry, and passwords before configuration or batch results are read.
- Every public batch restricts charts to `onReport=true` and `draft=false`. It projects runtime output onto the public chart configuration instead of returning private query/dataset settings.
- URL variables and dashboard variables are merged under the share policy on the server for every batch; fixed policy values cannot be overridden when `allow_params=false`.
- Passwords travel in the `pass` header. Initial requests and batches are cancelled when the URL or credentials change. A batch access failure clears displayed data and restores the access prompt.
- Internal snapshot URLs load all published widgets through the bounded queue. Snapshot capture waits for `data-dashboard-loading=false` before taking the full-page image.

### Chart Widget

- `client/src/containers/Chart/Chart.jsx`
- Exposed filter UI is controlled by the parent dashboard surface in phase 1
- Falls back to legacy local behavior only for out-of-scope surfaces such as shared/embedded flows

## Client Payload Semantics

The normalized payload builder lives in:

- `client/src/modules/chartRuntimeFilters.js`

It guarantees:

- variables are separated from filters
- duplicate identical filters are deduped
- filter order is stable for hashing
- `needsSourceRefresh` becomes `true` for runtime variables or dashboard date-range filters
- `filterHash` is based on the canonical payload, not raw dashboard state

## Server Normalization

The server runtime context lives in:

- `server/modules/chartRuntimeFilters.js`

It is built inside:

- `server/controllers/ChartController.js`

The server context is responsible for:

- normalizing incoming variables and filters
- intersecting chart date windows with dashboard date ranges
- determining whether the runtime payload requires a source refresh
- resolving dataset-scoped filters for each CDC

## Execution Path

### Route Level

- `/project/:project_id/chart/:chart_id/query`
  - normal chart query path
- `/project/:project_id/chart/:chart_id/filter`
  - runtime-only path for dashboard interactions
  - does not persist filtered chart data back to the database

### Controller Level

- `ChartController.updateChartData()`
  - builds runtime context
  - forces `noSource=false`, `skipParsing=false`, `getCache=false` when runtime variables or dashboard date-range filters require a source refresh
  - prevents runtime-only requests from persisting chart data or polluting cache state

### Connector Level

- `DatasetController.runRequest()`
  - merges runtime variables with CDC variable defaults before each request
- `ConnectionController.runApiRequest()`
  - applies the effective intersected date range to reserved API placeholders such as `{{start_date}}` and `{{end_date}}`

### Visualization Level

- `server/visualization/filterDatasets.js`
- `server/visualization/frameBuilder.js`
- `server/visualization/VisualizationEngine.js`

These apply:

- effective chart date window
- dashboard field filters
- chart-local exposed filters

All non-variable filters use AND logic. CDC-scoped filters only apply to the matching binding. Row filtering happens before semantic grouping, aggregation, breakdown-series generation, and presentation formulas.

## Persistence And Cache Rules

Dashboard filter presentation order is stored separately on `DashboardFilter.position`. Private and public dashboard queries return shared filters in that order, but `position` is not included in the runtime payload. Reordering filters therefore does not change AND semantics, refresh chart data, or create a new runtime cache variant.

### Query Route

- Can persist chart data and refresh `chartDataUpdated`
- Used for explicit chart refreshes without runtime filters
- Can still use connector/datarequest cache when `getCache=true`

### Filter Route

- Runtime-only
- Returns filtered chart data to the caller
- Does not persist runtime-filtered results to the database
- Can read/write runtime Redis cache entries when the normalized runtime payload is cacheable

### Runtime Redis Cache

- `chart-cache:*`
  - final chart payload for a chart version + runtime variant
- `source-cache:*`
  - raw dataset/source payload for a dataset version + source-affecting runtime variant
- `runtime-cache:*`
  - registries/metadata for the runtime cache keys

See `server/docs/agents/caching-guide.md` for details.

## Example Scenario

Given a SQL dataset query:

```sql
SELECT type, COUNT(*) AS count
FROM Connection
WHERE createdAt > {{date_start}} AND createdAt < {{date_end}}
GROUP BY type
ORDER BY count DESC
LIMIT 5;
```

And:

- query variables `date_start` / `date_end` have saved defaults
- the chart exposes a CDC filter on `type`
- the dashboard adds variable filters for `date_start` / `date_end`

The effective behavior is:

1. Dashboard variable filters override the saved SQL variable defaults.
2. The chart-local exposed `type` filter is added to the same runtime payload.
3. The request runs once with both `variables` and `filters`.
4. The final result is equivalent to:
   - dashboard variable overrides
   - AND chart-local `type` constraint

## Surface Coverage

Authenticated dashboards, public dashboards, reports, shared charts, embeds, snapshots, automated updates, and editor refreshes all enter the canonical chart controller and visualization-engine boundary. Some surfaces construct their runtime payload differently, but filtering and compilation share the same server implementation.
