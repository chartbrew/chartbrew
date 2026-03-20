# Visualization V1 to V2 Migration Contract

## Purpose
- This document records the live JSON contract boundaries for visualization migration work in `chartbrew-os`.
- It exists because Chartbrew does not use TypeScript model types for these payloads, and the current OpenAPI schemas are not yet a complete description of the runtime shapes.
- Until OpenAPI is aligned, treat the server models/controllers plus this document as the source of truth for V1 to V2 mapping.

## Runtime Boundary
- `DataRequest` remains the connector/request-execution layer.
  - This is where SQL/API/Firestore/RealtimeDB/Customer.io/GA-specific request settings live.
  - V2 does not move connector-specific request settings into `vizConfig`.
- `Dataset` remains the reusable semantic layer.
  - This is where traversal paths, reusable conditions, date field semantics, joins, and `fieldsMetadata` live.
- `ChartDatasetConfig` remains the chart-instance layer.
  - This is where chart-specific legend/color/formula/sort/limit/goal settings live.
  - In V2, it also owns `vizVersion` and `vizConfig`.

The V2 engine starts after `DatasetController.runRequest()` has already:
- executed connector-specific `DataRequest` logic
- applied request variables
- applied request transforms
- joined multiple requests when the dataset defines joins

## Layer Ownership

### 1. `DataRequest`
Use `DataRequest` for anything required to fetch or reshape source data before the dataset semantic layer runs.

Common fields:
- `connection_id`
- `method`
- `route`
- `headers`
- `body`
- `query`
- `pagination`, `itemsLimit`, `offset`, `paginationField`, `template`
- `conditions`
- `configuration`
- `transform`
- `VariableBindings`

`configuration` is connector-specific. Current live examples from the model comments include:
- Firestore:
  - `mainCollectionSample`
  - `subCollectionSample`
  - `selectedSubCollection`
  - `limit`
  - `orderBy`
  - `orderByDirection`
- Customer.io:
  - `populateAttributes`
- Google Analytics:
  - `accountId`
  - `propertyId`
  - `metrics`
  - `dimensions`
  - `startDate`
  - `endDate`
- RealtimeDB:
  - `limitToLast`
  - `limitToFirst`

Important compatibility note:
- Live code executes `transform.config`, not `transform.configuration`.
- Any future OpenAPI alignment must document `config` as the runtime shape unless the server is changed.

Example `DataRequest` for an API connector:

```json
{
  "connection_id": 14,
  "method": "GET",
  "route": "/v1/orders?region={{region}}",
  "headers": {
    "Authorization": "Bearer {{api_key}}"
  },
  "pagination": true,
  "paginationField": "next_cursor",
  "template": "cursor",
  "configuration": {},
  "transform": {
    "enabled": true,
    "type": "flattenNested",
    "config": {
      "baseArrayPath": "orders",
      "nestedArrayPath": "items",
      "outputFields": {
        "orderId": { "from": "base", "path": "id" },
        "sku": { "from": "nested", "path": "sku" },
        "amount": { "from": "nested", "path": "amount" }
      }
    }
  }
}
```

Example `DataRequest` for Firestore-style configuration:

```json
{
  "connection_id": 22,
  "route": "orders",
  "conditions": [
    { "field": "status", "operator": "is", "value": "paid" }
  ],
  "configuration": {
    "mainCollectionSample": "orders",
    "selectedSubCollection": "items",
    "subCollectionSample": "orders/demo/items",
    "orderBy": "createdAt",
    "orderByDirection": "desc",
    "limit": 100
  }
}
```

### 2. `Dataset`
Use `Dataset` for reusable semantic meaning across charts.

Canonical fields for V2-aware datasets:
- `team_id`
- `project_ids`
- `draft`
- `name`
- `legend`
- `xAxis`
- `yAxis`
- `yAxisOperation`
- `dateField`
- `dateFormat`
- `conditions`
- `fieldsSchema`
- `fieldsMetadata`
- `joinSettings`
- `main_dr_id`
- `VariableBindings`

Important compatibility notes:
- `Dataset.name` is now the canonical display field.
- `Dataset.legend` is still kept in sync for legacy compatibility.
- Legacy traversal fields (`xAxis`, `yAxis`, `dateField`) remain on the dataset after migration.
  - V2 resolves `vizConfig.*.fieldId` back to these legacy paths through `fieldsMetadata`.
- `fieldsMetadata` is the V2 field catalog and should be preferred over `fieldsSchema` whenever both exist.

Example V2-aware dataset:

```json
{
  "team_id": 7,
  "project_ids": [449],
  "draft": false,
  "name": "Revenue by status",
  "xAxis": "root[].status",
  "yAxis": "root[].amount",
  "yAxisOperation": "sum",
  "dateField": "root[].created_at",
  "dateFormat": "YYYY-MM-DD",
  "conditions": [
    {
      "id": "status_filter",
      "field": "root[].status",
      "operator": "is",
      "value": "paid",
      "exposed": true
    }
  ],
  "fieldsSchema": {
    "root[].status": "string",
    "root[].amount": "number",
    "root[].created_at": "date"
  },
  "fieldsMetadata": [
    {
      "id": "status",
      "legacyPath": "root[].status",
      "type": "string",
      "label": "Status",
      "role": "dimension",
      "enabled": true
    },
    {
      "id": "amount",
      "legacyPath": "root[].amount",
      "type": "number",
      "label": "Amount",
      "role": "metric",
      "defaultAggregation": "sum",
      "enabled": true
    },
    {
      "id": "created_at",
      "legacyPath": "root[].created_at",
      "type": "date",
      "label": "Created At",
      "role": "date",
      "enabled": true
    }
  ]
}
```

### 3. `ChartDatasetConfig`
Use `ChartDatasetConfig` for chart-instance overrides and V2 chart-question state.

Legacy/live chart-instance fields:
- `legend`
- `formula`
- `datasetColor`
- `fillColor`
- `fill`
- `multiFill`
- `pointRadius`
- `excludedFields`
- `columnsOrder`
- `sort`
- `order`
- `maxRecords`
- `goal`
- `configuration.variables`

V2 fields:
- `vizVersion`
- `vizConfig`

Important compatibility notes:
- `ChartDatasetConfig.legend` still makes sense in V2 as a chart-specific series label override.
- Do not repurpose `Dataset.name` or `Dataset.legend` as a per-chart override; that belongs on the CDC.
- `configuration.variables` remains the place for CDC-specific runtime variable overrides even when `vizVersion = 2`.

Example migrated V2 CDC:

```json
{
  "id": "cdc_01",
  "dataset_id": 55,
  "legend": "Revenue",
  "datasetColor": "#2F6FED",
  "sort": "desc",
  "maxRecords": 10,
  "configuration": {
    "variables": [
      { "name": "region", "value": "EMEA" }
    ]
  },
  "vizVersion": 2,
  "vizConfig": {
    "version": 2,
    "dimensions": [
      {
        "id": "dimension_cdc_01",
        "fieldId": "status",
        "role": "x",
        "grain": null
      }
    ],
    "metrics": [
      {
        "id": "metric_cdc_01",
        "fieldId": "amount",
        "aggregation": "sum",
        "label": "Revenue",
        "axis": "left",
        "enabled": true,
        "style": {
          "color": "#2F6FED",
          "fillColor": "transparent",
          "lineStyle": "solid",
          "pointRadius": 0,
          "goal": null
        }
      }
    ],
    "filters": [],
    "filterControls": [],
    "sort": [
      { "ref": "metric_cdc_01", "dir": "desc" }
    ],
    "limit": 10,
    "postOperations": [],
    "options": {
      "includeEmptyBuckets": true,
      "visualization": {
        "type": "bar",
        "dataMode": "series",
        "mode": "chart",
        "table": null
      },
      "compatibility": {
        "legacyChartType": "bar",
        "legacyDimensionFieldId": "status",
        "legacyMetricFieldId": "amount",
        "legacyDateFieldId": "created_at"
      }
    }
  }
}
```

## V1 to V2 Mapping Rules

### What stays in place
- Connector/query execution stays on `DataRequest`.
- Dataset joins stay on `Dataset.joinSettings`.
- Reusable dataset conditions stay on `Dataset.conditions`.
- CDC runtime variable overrides stay on `ChartDatasetConfig.configuration.variables`.

### What gets added for V2
- `Dataset.fieldsMetadata`
- `ChartDatasetConfig.vizVersion`
- `ChartDatasetConfig.vizConfig`

### What is still preserved for compatibility
- `Dataset.xAxis`, `Dataset.yAxis`, `Dataset.yAxisOperation`, `Dataset.dateField`, `Dataset.dateFormat`
- `ChartDatasetConfig.legend`, `formula`, `sort`, `maxRecords`, `goal`, table formatting fields
- `Dataset.legend` as a compatibility mirror of `Dataset.name`

## Quick-Create Caveats

### `/datasets/quick-create`
- This route is a convenience constructor, not a full-fidelity mirror of every dataset field in storage.
- The controller explicitly strips legacy chart-owned fields such as:
  - `configuration`
  - `datasetColor`
  - `fillColor`
  - `fill`
  - `multiFill`
  - `pointRadius`
  - `groups`
  - `groupBy`
  - `sort`
  - `columnsOrder`
  - `maxRecords`
  - `goal`
- Current allowed dataset payload fields in the controller are:
  - `team_id`
  - `project_ids`
  - `draft`
  - `name`
  - `xAxis`
  - `xAxisOperation`
  - `yAxis`
  - `yAxisOperation`
  - `dateField`
  - `dateFormat`
  - `legend`
  - `conditions`
  - `fieldsSchema`
  - `fieldsMetadata`

### `/chart/quick-create`
- This route is chart-owned and can create CDCs directly.
- It remains the correct place for chart-instance fields and V2 CDC fields together.
- Current CDC payloads may include both:
  - legacy display/behavior fields such as `legend`, `formula`, `datasetColor`, `sort`, `maxRecords`
  - V2 fields `vizVersion` and `vizConfig`

## OpenAPI Alignment Gaps To Close
- `Dataset` schema in `chartbrew-docs/api-reference/openapi.json` does not yet fully document live V2-aware fields such as:
  - `name`
  - `fieldsMetadata`
  - some still-live legacy grouping/table fields
- `ChartDatasetConfig` schema does not yet include:
  - `vizVersion`
  - `vizConfig`
- `transform` documentation still describes `configuration`, while live server execution uses `transform.config`.

These gaps should be fixed in the API docs repo after this migration contract is accepted.
