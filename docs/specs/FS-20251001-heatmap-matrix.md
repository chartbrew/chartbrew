---
id: FS-20251001-heatmap-matrix
owner: Raz
status: done
links: ["PR #336"]
scope: web
---

## Problem
Users want a GitHub-like contribution heatmap to visualize density over time. Chartbrew lacks a matrix/heatmap chart type. We should add a Chart.js Matrix-based heatmap using `chartjs-chart-matrix`, integrate it like other chart types in `client/src/containers/Chart/Chart.jsx`, reuse the unified tooltip in `client/src/containers/Chart/components/ChartTooltip.js`, and, if needed, precompute data on the backend similar to `server/charts/AxisChart.js`/`server/charts/BarChart.js`. This chart must not display growth metrics.

## Goals
- Add a new "Heatmap (Matrix)" chart type powered by `chartjs-chart-matrix`.
- Integrate into the chart switch in `Chart.jsx` with a dedicated `MatrixChart` component.
- Use the existing external tooltip from `ChartTooltip.js` for consistent UX.
- Prepare data server-side to a stable, efficient format that supports filters/variables.
- Support a GitHub-like calendar heatmap (days vs weeks) for time series; also support generic matrix from categorical fields.
- Ensure growth is disabled and not computed for this chart type.
- Use primary `datasetColor` for heatmap intensity; ignore fill color in UI.

## Non-goals
- Advanced heatmap features (clustering, dendrograms, annotations).
- 3D heatmaps, gradient legends with continuous scales beyond a simple min→max range.
- Multiple overlays; MVP supports one dataset per chart (stacking not required).

## UX & API
- UI
  - New chart type option: "Heatmap (Matrix)".
  - Renders a grid where color intensity indicates value `v` per cell `{x, y, v}`.
  - Tooltip shows label (date or category), row/col, and formatted value via `ChartTooltip.js`.
  - Works in dashboards, embeds, public view; respects auto-update and dashboard filters/variables.
  - No growth chip/badge anywhere for this chart.
  - Only the first dataset (CDC) is rendered; additional CDCs are ignored/not visible.
- Configuration (front-end form)
  - Dimensions:
    - Time-based (GitHub-like): `dateField` (source field), `valueField` (numeric), aggregation (sum|count|avg|min|max), interval (week-based columns), y-axis as day-of-week [0..6].
    - Generic: `xField` (column dimension), `yField` (row dimension), `valueField`, aggregation.
  - Visual options:
    - Colors derived from primary `datasetColor`; intensity scales with normalized value (domain min→max). Ignore `fillColor` entirely for matrix.
    - Optional domain override; configurable cell size, border radius; discrete legend with 4–5 buckets.
    - Horizontal/vertical paddings responsive to `chartSize`. Hide fill color UI in `ChartDatasetConfig.jsx` when chart.type === "matrix".
  - Filtering: reuses dataset `conditions`, dashboard filters, and variables.
- API
  - No new endpoints. Reuse `runQuery`/`runQueryWithFilters`.
  - Server chart builder: `MatrixChart` returns `configuration` compatible with Chart.js Matrix plugin:
    - `data.labels` for columns (x) and an internal mapping for rows (y labels in `options.scales.y.labels` or `ticks.callback`).
    - `data.datasets[0].data` as array of `{x, y, v}`; `parsing: {x: 'x', y: 'y', v: 'v'}`.
  - Tooltip: pass `plugins.tooltip` to use `tooltipPlugin` with `isCategoryChart=true` so color dot/background matches series color.

## Data & Permissions
- Data shape (server → client)
  - For time-based heatmap:
    - Columns: weekly buckets between startDate/endDate (or dashboard range).
    - Rows: day-of-week 0..6 (Sun..Sat).
    - Value: aggregated metric per (weekIndex, dayOfWeek).
  - For generic heatmap:
    - Unique sorted `xField` as columns, `yField` as rows.
    - Value aggregated per (x, y).
  - Include lightweight metadata: `xLabels`, `yLabels`, `domain: {min, max}` for color scale.
- Permissions: same as other charts; public charts follow current sharing model. No extra ACL.
- Rate limits: unchanged.

## Risks
- Chart.js Matrix plugin integration and tree-shaking; ensure plugin registration per bundle slice only once.
- Large matrices (many weeks × 7) could impact render performance. Mitigate via data thinning and reasonable defaults.
- Data correctness for timezones when bucketing by weeks/days; follow `AxisChart` timezone logic.

## Definition of Done
- Server
  - New `server/charts/MatrixChart.js` that builds `{xLabels, yLabels, points: [{x, y, v}], domain}` per dataset, honoring filters and variables like `AxisChart` (date filters, variable bindings, conditions).
  - Integrate in `server/charts/AxisChart.js` dispatcher: when chart.type === "matrix" route to `MatrixChart` (or analogous orchestration) and skip growth calculation for this type.
  - Ensure dashboard date filters apply; variables replace `{{var}}` in conditions.
  - Tests under `server/tests` covering: time-based bucketing, filters, variables, domain min/max.
- Client
  - Add `MatrixChart.jsx` rendering Chart.js with `chartjs-chart-matrix` plugin; register plugin locally in the component.
  - Hook into `Chart.jsx` switch to render for `chart.type === "matrix"` and wire `ChartTooltip.js` external tooltip.
  - Color each cell using intensity derived from `datasetColor` and normalized `v`; never use `fillColor`.
  - Hide fill color controls in `ChartDatasetConfig.jsx` when chart.type === "matrix"; only show primary color.
  - Respect export to Excel (flatten matrix into tabular rows: xLabel, yLabel, value).
  - No growth UI shown for this chart anywhere.
- Docs
  - Update user docs with a short section on configuring Heatmap (Matrix).

## Acceptance Criteria
- Selecting "Heatmap (Matrix)" creates a chart that renders a grid with color intensity.
- GitHub-like mode: with a date field and value field, shows weeks as columns and days as rows for the selected range; respects timezone and dashboard date filters.
- Generic mode: mapping two categorical fields to rows/columns produces a matrix.
- Tooltip uses `ChartTooltip.js` and displays correct x, y labels and formatted value.
- Cell colors derive from primary `datasetColor`; `fillColor` is ignored. Fill color UI does not show for matrix charts.
- Growth is not computed server-side and is never displayed for this chart.
- Filtering (dataset conditions, dashboard filters, variables) changes the matrix accordingly.
- Export to Excel produces a table with headers `[Column (x), Row (y), Value]`.
- Only the first dataset (CDC) is rendered; additional CDCs are ignored/not visible.
- No new endpoints; performance is acceptable for 1-year weekly grid (< 100ms build on typical datasets).
