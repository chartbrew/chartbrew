# Next-Generation Visualization Engine

Status: in progress

## Summary

Chartbrew currently treats each `ChartDatasetConfig` as one rendered series and asks every
visualization to provide X- and Y-axis bindings. This spec replaces that assumption with a
declarative visualization grammar where a reusable dataset is bound once, visual layers select
semantic fields, and breakdown values generate series at runtime.

The change is invisible to users. There is no engine picker, preview mode, feature flag, or
manual conversion flow. Existing chart settings are deterministically converted to the new
specification and run through the same engine as newly created charts.

## Product Principles

- Users configure data meaning, not renderer internals.
- A dataset is a reusable query result, not a chart series.
- A data binding owns dataset-specific variables and source/filter scope.
- A visual layer owns one mark and its field encodings.
- A breakdown field generates runtime series; generated series are not persisted as CDC rows.
- Every visualization exposes only the field roles it actually needs.
- Existing dashboards migrate without user action or visible versioning.
- Advanced behavior is progressively disclosed in the editor, not placed in a separate mode.

## Goals

- Generate multiple stable series from one dataset and one data binding.
- Remove the universal X/Y requirement from the visualization core.
- Support long, wide, scalar, nested, pre-aggregated, sparse, and layered inputs.
- Keep Chart.js as the initial rendering target while making the data pipeline renderer-neutral.
- Preserve runtime filters, variables, cache variants, exports, alerts, goals, snapshots, embeds,
  templates, reports, and automated refreshes.
- Migrate all renderable existing charts through a deterministic, idempotent backend process.
- Replace the chart-series editor with a semantic field-and-breakdown workflow using HeroUI v3.

## Non-Goals

- Replacing Chart.js during the first rollout.
- Renaming or deleting `ChartDatasetConfig` before migration and parity are complete.
- Shipping every future chart type in the first release.
- Rewriting connection protocols, dataset queries, joins, or the runtime cache system.
- Committing customer-provided source data to the repository.

## Domain Model

### Dataset

Reusable source/query result. Owns DataRequests, joins, schema, access, and reusable data shape.

### Data binding

The existing `ChartDatasetConfig` record, initially retained as the physical storage model. It
owns the selected dataset, variable defaults, source-filter scope, and migration identity.

### Visualization specification

Chart-level declarative configuration stored in `Chart.visualization`. `version` is a persistence
schema version and never an engine-selection flag.

```json
{
  "version": 2,
  "layers": [
    {
      "id": "income",
      "bindingId": "cdc-uuid",
      "mark": "bar",
      "encoding": {
        "category": { "field": "root[].branch", "type": "nominal" },
        "value": {
          "field": "root[].income",
          "type": "quantitative",
          "aggregate": "sum"
        },
        "breakdown": { "field": "root[].level", "type": "nominal" }
      },
      "stack": "normal"
    }
  ]
}
```

### Visual layer

One visual mark using one data binding. Multiple layers can share a binding without executing the
dataset repeatedly. A true overlay or another source creates another layer/binding.

### Generated series

A runtime artifact identified by a stable key derived from the layer and the typed breakdown
value. Styling overrides reference this stable identity so row order changes do not change colors.

### VizFrame

Sparse, renderer-neutral output containing normalized rows, semantic field metadata, a generated
series catalog, warnings, and processing statistics. Chart.js, tables, exports, and alert metric
selection compile from the same frame.

## Supported Data Shapes

| Shape | Example | Engine capability |
| --- | --- | --- |
| Long/tidy | `branch, level, income` | group, aggregate, breakdown, stack |
| Wide | `date, revenue, cost, profit` | fold columns or create shared-binding layers |
| Raw events | `createdAt, status, region, amount` | filter, time unit, group, aggregate |
| Pre-aggregated | `month, segment, total` | explicit `none` aggregation and grain preservation |
| Scalar/object | `{ "total": 123 }` | value-only KPI/gauge encodings |
| Nested API | `{ "data": { "items": [] } }` | row selection, nested paths, flatten/explode |
| Sparse categorical | mostly absent category/series combinations | sparse frame and missing-value policy |
| Matrix | `row, column, value` | row/column/value encodings |
| Scatter/bubble | `x, y, category, size` | quantitative axes, color, and size |
| Geographic | `region, value` or coordinates | location/color/size encodings |
| Hierarchical | `parent, child, value` | hierarchy/path/value encodings |
| Flow | `source, target, value` | source/target/value encodings |
| Distribution | raw values or bins | bin/window/statistical transforms |
| Multi-source | actual vs target | multiple bindings, layers, and scales |

Future marks can be added through the capability registry without changing the core transform
contract. First production cutover still requires parity for every currently supported chart type.

## Processing Order

1. Build the normalized runtime filter and variable context.
2. Apply source-affecting filters and execute each unique binding signature once.
3. Select rows from arrays, nested API paths, or scalar objects.
4. Normalize field values and inferred types.
5. Apply row/date filters.
6. Apply calculated fields, flatten/explode, fold, bin, and time-unit transforms in declared order.
7. Group and aggregate.
8. Apply Top N/Other, sorting, limits, and missing-value policy.
9. Produce a sparse `VizFrame` and stable generated-series catalog.
10. Compile the frame for Chart.js, table/export, or metric/alert consumers.

Row-level filters must run before aggregation by default. Post-aggregate filtering is an explicit
transform so a pre-aggregated query cannot be silently treated as raw event data.

## Compatibility And Migration

1. Add nullable `Chart.visualization` storage.
2. Convert legacy chart and resolved CDC settings to a canonical v2 specification.
3. Backfill in deterministic, idempotent batches with a dry-run report.
4. Return an adapted canonical specification if an unmigrated chart is encountered.
5. Run both migrated and new specifications through the same engine facade.
6. Persist the canonical specification whenever an adapted chart is edited.
7. Make the field mandatory only after fallback usage is zero.
8. Remove the adapter, `AxisChart`, and deprecated presentation fields in a cleanup migration.

The adapter is a schema boundary, not a second rendering path. There will be no user-visible
engine state and no permanent runtime flag.

Local migration status on 2026-07-19: `20260719090000-add-chart-visualization.js` and
`20260719100000-refresh-legacy-visualization-specs.js` have both been applied by the running local
server. They are immutable; any subsequent persisted-schema or backfill correction must use a new
migration (or explicitly undo the latest migration before editing it).

## Editor UX

The chart editor uses this conceptual order:

1. Dataset
2. Visualization type in the ChartPreview toolbar
3. Fields
4. Filters
5. Display
6. Automation

Semantic slots vary by mark:

- Bar: Category, Value, Break down by
- Line: Time/Category, Value, Break down by
- Pie/doughnut: Category, Value
- KPI/gauge: Value
- Matrix: Row, Column, Value
- Scatter: X value, Y value, Color, Size

The default workflow exposes Dataset, Fields, Breakdown, and Filters. Users can add another numeric
value next to the Value field for wide datasets. `Layer` remains an internal engine concept and is
not exposed in the standard editor; mixed-mark composition requires a separately designed advanced
workflow. Selecting `Break down by` shows the generated series count, cardinality controls, null
policy, and stable style overrides.

The UI will reuse HeroUI v3 components and Chartbrew theme tokens. New state should be derived
from props, selectors, query state, and interaction handlers. New `useEffect` usage requires a
documented reason and should not be used for mirroring or synchronizing derivable state.

## Testing Strategy

- Pure unit tests for field selection, normalization, each transform, aggregation, stable IDs,
  null policy, and deterministic ordering.
- Golden fixtures for long, wide, scalar, nested, pre-aggregated, sparse, and multi-binding data.
- Synthetic exam-income fixtures that reproduce the customer data shape without copying customer
  labels, values, dates, currencies, branches, or level names.
- Legacy conversion tests for every chart type and all local formula shapes.
- Semantic parity tests comparing legacy and v2 labels, values, order, colors, format, goals, and
  growth while ignoring irrelevant object-key ordering.
- Integration tests for runtime filters, variables, cache variants, exports, public/embed routes,
  snapshots, reports, alerts, templates, AI-created charts, and automatic updates.
- Browser verification for editor keyboard behavior, accessibility, responsive layout, light/dark
  themes, empty/error/loading states, and customer-reference workflow.
- Performance tests for large row counts, high-cardinality breakdowns, and sparse output.

## Acceptance Gates

- One dataset and one layer can produce a stacked category chart broken down by a field.
- Adding a breakdown never adds a CDC or executes the dataset again.
- Generated series identity and colors are stable across refresh and row reordering.
- Missing values are not silently converted to zero.
- Every renderable legacy chart produces a valid v2 specification.
- All existing chart types render through one engine facade before production cutover.
- Users never see an engine choice, migration prompt, or version label.
- Current filters, exports, alerts, reports, snapshots, embeds, and caching retain behavior.
- `AxisChart` and legacy presentation fields have an explicit deletion gate.

## Implementation Checklist

### Discovery and contract

- [x] Research comparable breakdown/grouping models.
- [x] Inspect the current editor, runtime, filtering pipeline, and local chart inventory.
- [x] Define the invisible migration approach and one-engine constraint.
- [x] Define the supported dataset-shape matrix.
- [x] Create this implementation spec and checklist.
- [x] Add JSON schema/validation for visualization specifications.
- [x] Add the chart capability registry and semantic slot definitions.

### Engine kernel

- [x] Add field-path parsing and row selection for root, nested, array, and scalar data.
- [x] Add projection and normalized field metadata.
- [x] Add row-level filters and ordered transform execution.
- [x] Add group/aggregate operations.
- [ ] Add fold, flatten/explode, and bin transforms.
- [x] Add time-unit and cumulative-window transforms.
- [ ] Add Top N/Other.
- [x] Add sorting, limits, and explicit missing-value policies.
- [x] Add sparse `VizFrame` output.
- [x] Add stable generated-series IDs and style lookup keys.
- [ ] Add binding-signature request deduplication.

### Fixtures and tests

- [x] Add anonymized long-form exam-income fixtures.
- [x] Add wide, scalar, nested, pre-aggregated, sparse, and multi-binding fixtures.
- [x] Add kernel and invariant unit tests.
- [ ] Add high-cardinality and performance tests.
- [x] Add all current legacy formula variants to the regression corpus.

### Compatibility and persistence

- [x] Add `Chart.visualization` model field and migration.
- [x] Add deterministic `legacyChartToVisualization()` conversion.
- [x] Add dry-run, batch, idempotency, and failure reporting to the backfill.
- [x] Make chart API reads return a canonical visualization specification.
- [x] Persist canonical specs on edit and creation.
- [x] Refresh legacy-owned persisted specs through an immutable follow-up migration.
- [x] Synchronize legacy editor writes without overwriting native v2 specifications.
- [ ] Track temporary fallback usage until it reaches zero.

### Runtime and compilers

- [x] Add the single visualization engine facade in `ChartController`.
- [x] Compile line and bar frames to the current Chart.js payload.
- [x] Compile pie, doughnut, radar, and polar frames.
- [x] Compile KPI, average, and gauge frames.
- [x] Compile table, matrix, and markdown frames.
- [x] Move export to the canonical filtered binding/frame pipeline.
- [x] Compile formulas, goals, and growth metadata for generated series.
- [ ] Persist, edit, and consume goals, formulas, and growth through stable layer/series
  references instead of CDC or rendered-dataset array positions.
- [x] Preserve runtime filtering and cache semantics.
- [x] Cover the existing public, shared, embedded, report, snapshot, template, and auto-update
  routes with the full integration regression suite.
- [ ] Add direct golden assertions for alerts and metric selection against generated-series IDs.

### Dependent systems audit

- [x] Inventory CDC/dataset-to-series assumptions across server and client consumers.
- [ ] Replace alert targeting by `cdc_id` with an explicit generated-series metric target, with
  `specific series`, `any series`, and aggregate scopes.
- [ ] Migrate or pause ambiguous existing alerts instead of silently targeting the first generated
  series; include the series identity in alert-event deduplication.
- [ ] Move formula, goal, sort, and limit ownership from the data binding to the value layer where
  the behavior is presentation-specific.
- [ ] Define goal semantics and UX for per-series, repeated-per-series, and combined-total goals.
- [ ] Key KPI growth and goal metadata by stable series ID; remove positional CDC lookups and keep
  sparse metric output aligned.
- [ ] Define and test separate `chart as shown` and `source rows` export contracts; ensure generated
  series, goals, colors, and multiple value layers export predictably.
- [ ] Remap visualization binding IDs and preserve/remap layer style identities when cloning or
  importing custom dashboard templates.
- [ ] Make AI chart create/update tools mutate the canonical visualization specification, including
  category, value, time, and breakdown encodings.
- [ ] Generalize color editing from generated series to category slices for pie, doughnut, and polar
  visualizations.
- [ ] Add generated-series golden assertions for public, embedded, shared, report, snapshot, and
  auto-update outputs, beyond route/access regression coverage.
- [ ] Include the canonical visualization explicitly in runtime-cache fingerprints.
- [ ] Add generated-series search, visibility, ordering, and Top N/Other controls for high-cardinality
  breakdowns and define behavior after the palette is exhausted.

### Editor

- [x] Fetch current HeroUI v3 documentation for every component used.
- [x] Replace the series-first setup with Dataset, Visualization, Fields, Filters, Display, and
  Automation concepts.
- [x] Add mark-specific semantic field slots.
- [x] Add Break down by and generated-series summary.
- [x] Allow a selected breakdown field to be cleared without removing its dataset or value.
- [x] Replace Add metric/Add layer terminology with a contextual Add another value action; keep
  visual layers internal to the engine.
- [ ] Add cardinality, Top N/Other, null, and missing-value controls.
- [x] Assign distinct stable palette colors to generated series and expose per-series Display
  overrides with an automatic-color reset.
- [x] Add generated-series cardinality warnings.
- [x] Restore the CDC date-field control, infer it from semantic time bindings or sampled date
  fields, and keep Chart Settings/dashboard date filtering compatible.
- [ ] Add grain and filter-order warnings.
- [x] Verify no new avoidable `useEffect` state synchronization.
- [x] Keep the existing ChartPreview toolbar as the single visualization-type control; the
  semantic Build panel reacts to it without presenting a duplicate selector.
- [x] Verify semantic controls, accessible labels, and light/dark behavior on desktop.
- [ ] Verify the complete editor at phone widths after the existing global Sidebar shell overflow
  is fixed.

### Cutover and cleanup

- [ ] Run legacy/v2 parity against every renderable chart in the local migration corpus.
- [x] Report existing orphan charts separately from migration failures.
- [x] Run unit, integration, lint, build, and desktop browser verification gates.
- [x] Switch the primary production refresh, filter, table, export, and automated-update paths to
  the new facade.
- [ ] Confirm fallback usage is zero.
- [ ] Remove `AxisChart` and duplicated table/export parsing.
- [ ] Remove deprecated visualization fields in a contract migration.
- [ ] Update architecture and filtering documentation.

## Progress Log

- 2026-07-19: Completed product/market research, local inventory, customer-shape analysis, current
  editor inspection, compatibility strategy, and initial implementation specification.
- 2026-07-19: Added the v2 schema and validator, semantic mark registry, field-path normalization,
  ordered filter/aggregate/sort/limit kernel, sparse VizFrame, and stable generated-series IDs.
- 2026-07-19: Added synthetic long, wide, scalar, nested, pre-aggregated, sparse, and multi-binding
  fixtures. No customer-provided rows or values were copied into the repository.
- 2026-07-19: Added `Chart.visualization`, the batched/idempotent legacy backfill, the temporary
  in-memory adapter, and the first bar/line Chart.js compiler. Focused verification currently
  covers 36 passing tests across the new engine and adjacent legacy regression suites.
- 2026-07-19: Ran the read-only migration audit against the local Chartbrew corpus: 1,571 charts
  converted, 76 classified as drafts, 316 existing no-binding charts classified as orphans, and
  zero conversion failures. No local chart rows were changed by the audit.
- 2026-07-19: Full server unit verification passed with 56 files and 455 tests. Server lint passed
  with no errors; four unrelated pre-existing conditional-expect warnings remain in Jira tests.
- 2026-07-19: Added timezone-aware time bucketing and zero-domain expansion, value formulas,
  goals/growth metrics, cumulative windows, all current Chart.js/table/matrix/markdown compilers,
  and a filtered tabular export compiler.
- 2026-07-19: Added the immutable `20260719100000` follow-up migration to refresh only
  legacy-owned specs. The local server applied it automatically; all 1,571 migrated rows retain
  legacy ownership and native v2 specifications are explicitly excluded from refresh.
- 2026-07-19: Cut the primary chart refresh, table, runtime-filter, export, and automated-update
  pipeline over to `VisualizationEngine`. CDC/runtime-cache integrations pass, and legacy editor
  mutations now re-derive legacy-owned specs without touching native specifications.
- 2026-07-19: Added the HeroUI semantic editor without new `useEffect` synchronization. In browser
  verification, one dataset using category, value, and breakdown fields generated ten stable
  chart series, rendered successfully, and retained the native specification after a full reload.
- 2026-07-19: Desktop dark/light and accessible semantic-control checks passed. Phone-width QA
  exposed an existing global Sidebar shell overflow outside this editor; complete mobile QA is
  deliberately retained as a follow-up instead of widening this engine slice into navigation work.
- 2026-07-19: Verification passed with 63 server unit files (482 tests), 18 server integration
  files (112 tests), five client visualization-module tests, server/client lint, and the client
  production build. Server lint retains four unrelated pre-existing Jira test warnings.
- 2026-07-19: Removed the duplicate visualization-type selector from the Build panel. The existing
  ChartPreview toolbar is the canonical control and its compatibility path continues to update
  native visualization marks; Table transitions now initialize the default row collection.
- 2026-07-19: Simplified the Build panel after usability review. The standard workflow now exposes
  only fields, values, breakdown, and filters; internal metric/layer terminology and the duplicate
  dataset summary card were removed. Existing multiple values remain editable without exposing the
  engine model.
- 2026-07-20: Generated breakdown series now receive distinct automatic colors from Chartbrew's
  existing palette. Display lists the runtime series as compact color chips; overrides are stored
  against stable generated-series IDs and can be reset to automatic assignment. Focused compiler
  tests, six client visualization-module tests, client/server lint, the production client build,
  and dark-mode browser interaction verification pass.
- 2026-07-20: Restored date-field compatibility in the semantic editor. Time bindings now populate
  the CDC date field, sampled schemas provide a created-date-first fallback, and the visualization
  runtime applies the same inference for unmigrated or newly sampled bindings. The immutable
  `20260720103000` migration backfilled persisted time bindings and was applied automatically by
  the running local server.
- 2026-07-20: Audited dependent systems for remaining CDC-equals-series assumptions. Confirmed
  correctness gaps in alert evaluation, KPI metric alignment, custom-template binding remapping,
  and AI updates of native specifications; identified ambiguous goal/formula ownership, export
  contract gaps, category-slice color UX, and high-cardinality controls as release gates. The local
  copy currently has 12 alerts (5 active), eight goal charts, and 391 formula charts, with no
  current overlap between those records and breakdown charts.
- 2026-07-20: Added the native HeroUI autocomplete clear action to the optional breakdown field.
  Clearing it removes the breakdown encoding, generated-series configuration, and saved selection
  while preserving the dataset, category, and value fields.
