# Axis Chart Performance & Streaming Data Pipeline

## Overview
Large datasets (e.g., Firestore collections, API payloads) currently load fully into memory before `AxisChart` runs. The aggregation pipeline repeatedly parses dates with `moment`, scans arrays with `lodash`, and builds intermediate arrays for filters and legends, which stalls dashboards and exhausts memory. This spec defines a set of incremental backend improvements that preserve existing chart outputs while dramatically reducing CPU and memory usage:

1. Stream dataset rows from `DatasetController.runRequest()` to the chart pipeline.
2. Normalize date values once per row using existing field selector heuristics.
3. Replace array-based aggregation with map/set structures keyed by axis values.
4. Consolidate redundant filter passes and lazy-build condition metadata.
5. Share resolved date windows between ChartController and AxisChart.

All changes must respect the current field selector logic (`root[].path`, API auto-detection) so non-uniform payloads continue to work.

## Goals
- Enable `ChartController.updateChartData()` to start processing dataset rows before the entire response arrives, lowering latency and memory.
- Reduce per-row CPU cost inside `AxisChart` by normalizing dates once and reusing numeric timestamps for comparisons.
- Ensure filters and conditions run in a single pass per dataset while supporting the existing condition builder UX.
- Maintain backward-compatible chart outputs (legends, tooltips, bins) even as internal data structures change.
- Provide regression tests comparing legacy vs. optimized outputs for representative chart types and data sources.

## Non-Goals
- No redesign of the dataset schema or chart builder UI (handled in other specs).
- No changes to the determineType heuristics; we reuse them.
- No new aggregation types or chart features—strictly performance/architecture.

## Streaming Dataset Execution
- Update `DatasetController.runRequest()` to optionally return an async iterator (`for await (row of datasetStream)`), emitting normalized rows as soon as source data arrives.
- For SQL/Mongo: leverage cursor APIs; for APIs/Firestore: paginate via existing mechanisms, emitting each batch.
- Default behavior remains returning full arrays. A new flag (`stream: true`) enables streaming and is only used by `ChartController` for axis charts at first.
- Ensure field selectors (`root[].path`) apply per row before emitting to the stream so AxisChart always receives uniform `{ data, options }` objects.
- Add back-pressure support: AxisChart signals when it’s ready for more rows to avoid overwhelming memory.

## Date Normalization
- Introduce `modules/dateOps.js` with helpers:
  - `parseDate(value, timezone, formatHint)` → returns numeric timestamp + cached `moment` if needed.
  - `bucketTimestamp(ts, timeInterval)` → integer bucket key.
  - `isWithinRange(ts, startTs, endTs)` using cached `moment` comparisons only when necessary.
- AxisChart uses the selector to extract a raw value, then calls `parseDate` once per row, storing the timestamp in a local cache keyed by row+field.
- `ChartController` computes chart-level `startDate`/`endDate` once (respecting timezone, `currentEndDate`, `fixedStartDate`) and passes numeric timestamps plus `moment` objects down to AxisChart.
- Preserve existing mix of `moment` and native `Date` where benchmarks dictate (e.g., `moment.isBefore` for comparisons) but centralize the choice inside `dateOps`.

## Map-Based Aggregation
- Replace array scans inside AxisChart with `Map`/`Object` keyed by X-axis bucket:
  - `const xBuckets = new Map();`
  - Each bucket stores aggregated Y values, counts, min/max needed for tooltips/goals.
- After processing all rows (or streaming completion), convert the map to sorted arrays for Chart.js (`labels` + `datasets`).
- Use stable key generation (stringified bucket number or category) to ensure deterministic ordering.
- Ensure `conditionsOptions` collection uses maps to avoid duplicates and build values lazily.

## Filter Consolidation
- Combine dataset conditions, dashboard filters, and exposed filters into a single predicate pipeline per row:
  - Precompute active filters before streaming starts.
  - For each row, run the combined predicate once; if it passes, apply aggregations.
- `conditionsOptions` only populate for fields marked `exposed` or when the UI explicitly requests them.
- Add memoization for field selectors when multiple filters reference the same field, so we don’t call `_.get` repeatedly.

## AxisChart / ChartController Changes
- `ChartController.updateChartData()`:
  - Pass resolved `dateWindow` `{ startTs, endTs, startMoment, endMoment }` and timezone to AxisChart.
  - When `stream: true`, provide AxisChart with dataset async iterators instead of arrays; AxisChart consumes them sequentially.
  - Continue caching per dataset; when streaming, buffer the final normalized dataset if caching is enabled.
- `AxisChart.plot()`:
  - Detect stream vs. array input; wrap array inputs with a simple iterator for code reuse.
  - Use the new date ops and map aggregation.
  - Provide hooks (`onChunkProcessed`) for telemetry to measure chunk sizes and processing time.

## Testing & Validation
- Snapshot tests: run existing representative datasets (Mongo, SQL, API) through both legacy and new paths, assert identical chart configuration output.
- Stress tests: synthetic dataset with >1M rows streamed to ensure memory stays bounded and processing time decreases.
- Feature flag `axisChartPerf` gates new behavior; allow per-team rollouts.

## Telemetry
- Track `axis_stream_enabled`, `axis_stream_chunks_processed`, `axis_date_parse_time_ms`, `axis_memory_peak_mb`.
- Emit warnings when fallback to non-streaming occurs (e.g., unsupported connection type).

## Risks & Mitigations
- **Field selector regressions**: keep selector logic untouched; streaming yields already-selected rows to avoid duplicating logic.
- **Cache complications**: when streaming, ensure final aggregated data is stored for cache usage; otherwise disable caching for that run and log.
- **Library mix**: centralize the “best” operations in `dateOps` and cover with tests so future contributors don’t unknowingly degrade performance.
- **Backpressure**: implement simple buffer limits (e.g., process 5k rows at a time) and pause upstream cursors if AxisChart lags.
