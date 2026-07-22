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
- Uses `client/src/modules/chartRuntimeFilters.js` to build one payload per chart

### Public Dashboards / Reports

- `client/src/containers/PublicDashboard/PublicDashboard.jsx`
- `client/src/containers/PublicDashboard/Report.jsx`
- Use the same runtime payload builder as the private dashboard

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
