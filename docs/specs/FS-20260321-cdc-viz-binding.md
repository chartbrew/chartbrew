# CDC Viz Binding Split

Status: draft

## Overview

`Dataset` currently mixes source/data concerns with chart-binding concerns. This makes datasets hard to reuse because changing `xAxis`, `yAxis`, `dateField`, `formula`, or `conditions` changes behavior globally across all charts using that dataset. This spec moves the visualization binding layer to `ChartDatasetConfig` and keeps `Dataset` focused on data retrieval, joins, schema, and variables.

This is a minimal pass, not a new visualization engine. The goal is to change ownership of config without rewriting the chart pipeline.

## Scope

- Move chart-binding fields from `Dataset` to `ChartDatasetConfig`.
- Include `conditions` in the move so chart-specific filters stop mutating shared datasets.
- Add `Dataset.name` as the canonical dataset name and backfill it from `legend`.
- Keep the current chart processing pipeline and payload shape.
- Add a migration script that copies existing dataset visualization values into each related CDC.
- Migrate dataset naming code from `legend` to `name`, with legacy fallback during the transition.
- Update AI orchestrator entity definitions and tools to match the new dataset/CDC shape.
- Keep legacy dataset fields as fallback for one pass to reduce migration risk.

## Data Model

- Add `name` to `Dataset`.
- Add these nullable fields to `ChartDatasetConfig`:
  - `xAxis`
  - `xAxisOperation`
  - `yAxis`
  - `yAxisOperation`
  - `dateField`
  - `dateFormat`
  - `conditions`
- Keep existing CDC fields as-is:
  - `legend`, `formula`, `datasetColor`, `fillColor`, `fill`, `multiFill`, `pointRadius`, `excludedFields`, `sort`, `columnsOrder`, `order`, `maxRecords`, `goal`, `configuration`
- Keep these dataset fields for now as legacy fallback only:
  - `xAxis`, `xAxisOperation`, `yAxis`, `yAxisOperation`, `dateField`, `dateFormat`, `legend`, `conditions`, `formula`

## Ownership Rules

- `Dataset` owns:
  - `name`
  - `DataRequests`, `joinSettings`, `main_dr_id`, `fieldsSchema`, variable bindings, source query logic, reusable data shape
- `ChartDatasetConfig` owns:
  - dimension/metric/date binding
  - chart-specific conditions
  - formula and legend
  - per-chart display and ordering settings

## Naming Rules

- `Dataset.name` becomes the canonical dataset display name.
- `ChartDatasetConfig.legend` remains chart-specific label text.
- `Dataset.legend` remains temporary legacy fallback only.
- During transition, reads should prefer:
  - dataset name: `name || legend`
  - chart label: `cdc.legend || dataset.name || dataset.legend`

## Runtime Changes

- Do not add a new persisted model.
- In `ChartController.updateChartData()`, build the runtime `options` object for each dataset from:
  - base dataset fields
  - CDC binding overrides
- The runtime shape returned to chart modules stays:
  - `{ data, options }`
- Merge precedence:
  - CDC field if present
  - otherwise dataset legacy field
- Set runtime `options.id` to `cdc.id` and keep `options.dataset_id` as the underlying dataset id.
- Update condition-option persistence to write back to `ChartDatasetConfig.conditions`, not `Dataset.conditions`.

## Server Touchpoints

- `server/models/models/dataset.js`
- `server/models/models/chartdatasetconfig.js`
- `server/controllers/ChartController.js`
- `server/controllers/DatasetController.js`
- `server/charts/AxisChart.js`
- `server/charts/DataExtractor.js`
- `server/charts/TableView.js`
- dataset name callers still reading `legend`

## UI Changes

- Stop treating the dataset builder as the owner of chart-binding config.
- Move dimension/metric/date/formula/filter editing to CDC-backed flows in the chart editor.
- Keep the dataset page focused on query/data concerns only.
- Extract reusable field-picker and filter UI from `DatasetBuilder.jsx` so it can be used by CDC configuration.
- Update dataset-to-chart creation flow to initialize CDC binding values directly instead of copying the dataset object wholesale.
- Update dataset naming UI to edit `name`, not `legend`, with fallback while older data is still present.

## Dataset Page UX

- Remove the `Configure` dataset step/menu entirely.
- The dataset page becomes a data-definition screen:
  - query / API request / join settings
  - transforms
  - sample response / field discovery
- When saving a draft dataset, open a confirmation modal first so the user can:
  - confirm or edit the dataset name
  - assign dashboard tags before publishing the dataset
- Main CTA rules:
  - `Save dataset` when opened from the dataset list or other standalone dataset entry points
  - `Save & return to chart` when opened from the chart editor flow
- Keep the existing route/query-param behavior that already distinguishes chart-origin flows.

## Chart Editor UX

- The right-side dataset panel becomes the primary home for per-series configuration.
- Rename the first CDC tab from `Binding` to `Data setup`.
- Keep dataset/series tabs at the top so users can switch between `Signups`, `Active trials`, etc.
- For the selected series, split the right panel into tabs:
  - `Data setup`
    - series name
    - edit dataset CTA
    - dimension (`xAxis`)
    - metric (`yAxis`)
    - operation (`yAxisOperation`)
    - date field
    - filters
  - `Display`
    - colors
    - fill / multi-fill
    - sort
    - max records
    - formula
    - goal
  - `Automation`
    - variables
    - alerts
- `Chart Settings` stays outside the dataset panel as chart-global configuration.
- This split should preserve all current CDC controls; the work is a reorganization, not a reduction of functionality.

## Field Discovery & Suggestions

- `Data setup` should auto-suggest optimal dimension / metric / operation / date field when the CDC does not have them yet.
- Reuse the current dataset-preview request behavior used by `Dataset.jsx` / `DatasetBuilder.jsx` to fetch enough sample data to build field options.
- Reuse `autoFieldSelector` logic where possible so default suggestions stay consistent with the current dataset flow.
- Reuse `DatasetFilters.jsx` for CDC conditions if possible, but make it operate on CDC-backed data instead of dataset-backed data.

## Client Touchpoints

- `client/src/containers/Dataset/Dataset.jsx`
- `client/src/containers/Dataset/DatasetBuilder.jsx`
- `client/src/containers/AddChart/components/ChartDatasetConfig.jsx`
- `client/src/components/DatasetFilters.jsx`
- client callers that display dataset titles from `legend`
- chart/dashboard filter consumers that currently read `cdc.Dataset.conditions`

## Remaining Work

The implementation is mostly complete. The remaining work is intentionally narrow and should not reopen the architecture.

### 1. Orchestrator Compatibility

The AI orchestrator still needs to be aligned with the new ownership model.

Required outcomes:
- dataset entities should use `name` as the canonical dataset label
- chart-series / CDC creation should treat `legend` as chart-specific label text
- dataset creation and update tools should stop treating dataset `legend` as the primary dataset name
- chart creation tools should default CDC `legend` from `dataset.name || dataset.legend`
- orchestrator prompts and tool schemas should describe binding fields as CDC-owned, not dataset-owned

Files to review:
- `server/modules/ai/orchestrator/orchestrator.js`
- `server/modules/ai/orchestrator/entityCreationRules.js`
- `server/modules/ai/orchestrator/tools/createDataset.js`
- `server/modules/ai/orchestrator/tools/updateDataset.js`
- `server/modules/ai/orchestrator/tools/createChart.js`
- `server/modules/ai/orchestrator/tools/createTemporaryChart.js`

Acceptance criteria:
- AI-created datasets return `name` correctly populated
- AI-updated datasets modify `name` instead of relying on `legend`
- AI-created charts create CDCs with correct `legend` fallback and do not copy binding fields back onto `Dataset`
- orchestrator-facing entity descriptions match the current runtime model

### 2. Finish Dataset Name Migration In Remaining Callers

Most active UI paths now prefer `dataset.name || dataset.legend`, but a few legacy or secondary callers still read `legend` directly as if it were the dataset name.

This remaining pass should:
- migrate display/search-only dataset name callers to `name || legend`
- leave runtime series-label usages alone where `legend` is still the correct chart label key

Important distinction:
- keep `legend` where the code is referring to chart-series identity or chart-data lookup keys
- migrate to `name || legend` where the code is rendering or searching for the reusable dataset itself

Known remaining callers to review:
- `client/src/containers/AddChart/components/Dataset.jsx`
- any remaining dataset list / picker / breadcrumb / modal labels not yet updated
- any server-side dataset labels returned to the UI that still prefer `legend`

Acceptance criteria:
- reusable dataset labels render consistently across the UI using `name || legend`
- no chart runtime lookups break because of an over-eager `legend` replacement

### 3. Reuse Verification

This is a verification task, not a new implementation phase.

Scenarios to verify:
- the same dataset can be used by multiple charts with different `xAxis`, `yAxis`, `yAxisOperation`, `dateField`, and `conditions`
- hiding a filter in one chart does not hide it in another chart using the same dataset
- changing a chart-level condition in one CDC does not mutate the shared dataset or another CDC
- chart creation from an existing dataset still produces a usable default series configuration

Acceptance criteria:
- CDC-owned bindings are isolated per chart
- dataset reuse behaves as expected across at least two charts using the same underlying dataset

## Orchestrator Compatibility

- Update orchestrator contracts so datasets use `name` as the entity name and CDC owns visualization binding fields.
- Review and migrate:
  - `server/modules/ai/orchestrator/orchestrator.js`
  - `server/modules/ai/orchestrator/entityCreationRules.js`
  - `server/modules/ai/orchestrator/tools/createDataset.js`
  - `server/modules/ai/orchestrator/tools/updateDataset.js`
  - chart creation/update tools that still default CDC legend from `dataset.legend`
- The final step of the rollout is updating orchestrator prompts, tool schemas, selected attributes, and returned entity payloads so AI-generated entities match the new runtime model.

## Migration

- Write a migration script that:
  - backfills `Dataset.name` from `legend` where `name` is empty
  - finds every `ChartDatasetConfig`
  - copies matching legacy visualization fields from its linked `Dataset` into the CDC if the CDC field is empty
  - copies `conditions` from dataset to CDC
- Migration should be idempotent.
- Do not delete legacy dataset columns in the same pass.
- After migration, new writes go to CDC first while reads still support dataset fallback.

## Progress

- [x] Add `Dataset.name` and backfill from `legend`.
- [x] Add new CDC fields and model accessors.
- [x] Add migration script to backfill CDC visualization fields from datasets.
- [~] Update dataset callers to prefer `name` over `legend`.
- [x] Merge dataset + CDC binding at runtime in `ChartController`.
- [x] Persist condition options to CDC instead of dataset.
- [x] Move dataset builder writes from `updateDataset` to `updateCdc` for binding fields.
- [x] Update chart/dashboard filter consumers to read CDC conditions.
- [ ] Update orchestrator tool schemas, rules, and payloads to use `Dataset.name` and CDC-owned binding fields.
- [ ] Verify reuse: same dataset used by multiple charts with different bindings and filters.

## Notes

- This pass intentionally avoids removing legacy dataset viz fields.
- This pass intentionally avoids removing `Dataset.legend`; it becomes compatibility-only until callers are migrated.
- `Dataset.legend` should now be treated as a compatibility field only. New product logic should not introduce additional dataset-name reads from `legend` unless there is a compatibility reason.
- This pass intentionally avoids a new viz engine or payload redesign.
- The client now treats the dataset page as query-only and moves per-series setup to chart-side `Data setup / Display / Automation` tabs.
- Once stable, a follow-up spec can remove legacy dataset binding fields entirely.
