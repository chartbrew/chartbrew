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
- Move dimension/metric/date/formula/filter editing to CDC-backed flows.
- Keep the dataset page focused on query/data concerns.
- Extract reusable field-picker and filter UI from `DatasetBuilder.jsx` so it can be used by CDC configuration.
- Update dataset-to-chart creation flow to initialize CDC binding values directly instead of copying the dataset object wholesale.
- Update dataset naming UI to edit `name`, not `legend`, with fallback while older data is still present.

## Client Touchpoints

- `client/src/containers/Dataset/Dataset.jsx`
- `client/src/containers/Dataset/DatasetBuilder.jsx`
- `client/src/containers/AddChart/components/ChartDatasetConfig.jsx`
- `client/src/components/DatasetFilters.jsx`
- client callers that display dataset titles from `legend`
- chart/dashboard filter consumers that currently read `cdc.Dataset.conditions`

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

- [ ] Add `Dataset.name` and backfill from `legend`.
- [ ] Add new CDC fields and model accessors.
- [ ] Add migration script to backfill CDC visualization fields from datasets.
- [ ] Update dataset callers to prefer `name` over `legend`.
- [ ] Merge dataset + CDC binding at runtime in `ChartController`.
- [ ] Persist condition options to CDC instead of dataset.
- [ ] Move dataset builder writes from `updateDataset` to `updateCdc` for binding fields.
- [ ] Update chart/dashboard filter consumers to read CDC conditions.
- [ ] Update orchestrator tool schemas, rules, and payloads to use `Dataset.name` and CDC-owned binding fields.
- [ ] Verify reuse: same dataset used by multiple charts with different bindings and filters.

## Notes

- This pass intentionally avoids removing legacy dataset viz fields.
- This pass intentionally avoids removing `Dataset.legend`; it becomes compatibility-only until callers are migrated.
- This pass intentionally avoids a new viz engine or payload redesign.
- Once stable, a follow-up spec can remove legacy dataset binding fields entirely.
