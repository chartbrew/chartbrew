import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { buildVisualizationFilterPlan } = require("../../modules/visualizationV2/filterPlan.js");

describe("visualizationV2 filter plan", () => {
  it("resolves fieldId-based question filters from runtime variables and dashboard bindings", () => {
    const plan = buildVisualizationFilterPlan({
      chart: {
        id: 11,
        ChartDatasetConfigs: [{
          id: "cdc_1",
          vizConfig: {
            filters: [
              {
                id: "status_filter",
                fieldId: "status",
                operator: "is",
                valueSource: "variable",
                value: "{{status}}",
              },
              {
                id: "created_at_filter",
                fieldId: "created_at",
                type: "date",
                operator: "between",
                valueSource: "dashboardFilter",
                bindingId: "orders_date_range",
              },
            ],
          },
        }],
      },
      datasets: [{
        options: {
          id: 42,
          cdcId: "cdc_1",
          conditions: [{
            id: "dataset_only_filter",
            field: "root[].team_id",
            operator: "is",
            value: "t_1",
          }],
          fieldsMetadata: [
            { id: "status", legacyPath: "root[].status", type: "string" },
            { id: "created_at", legacyPath: "root[].created_at", type: "date" },
          ],
          fieldsSchema: {
            "root[].status": "string",
            "root[].created_at": "date",
            "root[].team_id": "string",
          },
        },
        data: [],
      }],
      filters: [{
        id: "orders_date_range",
        type: "date",
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-01-31T23:59:59.000Z",
      }],
      variables: {
        status: "paid",
      },
    });

    expect(plan.datasets[0].options.conditions).toEqual([
      {
        id: "dataset_only_filter",
        field: "root[].team_id",
        operator: "is",
        value: "t_1",
      },
      {
        id: "v2_question_status_filter",
        field: "root[].status",
        operator: "is",
        value: "paid",
        exposed: false,
        source: "v2_question",
        bindingId: null,
        filterId: "status_filter",
      },
      {
        id: "v2_question_created_at_filter_start",
        field: "root[].created_at",
        operator: "greaterOrEqual",
        value: "2026-01-01T00:00:00.000Z",
        exposed: false,
        source: "v2_question",
        bindingId: "orders_date_range",
        filterId: "created_at_filter",
      },
      {
        id: "v2_question_created_at_filter_end",
        field: "root[].created_at",
        operator: "lessOrEqual",
        value: "2026-01-31T23:59:59.000Z",
        exposed: false,
        source: "v2_question",
        bindingId: "orders_date_range",
        filterId: "created_at_filter",
      },
    ]);
  });

  it("normalizes fieldId runtime filters into scoped legacy-path filters", () => {
    const plan = buildVisualizationFilterPlan({
      chart: {
        id: 12,
        ChartDatasetConfigs: [{
          id: "cdc_scope",
          vizConfig: {
            filters: [],
          },
        }],
      },
      datasets: [{
        options: {
          id: 51,
          cdcId: "cdc_scope",
          conditions: [],
          dateField: "root[].created_at",
          fieldsMetadata: [
            { id: "status", legacyPath: "root[].status", type: "string" },
            { id: "created_at", legacyPath: "root[].created_at", type: "date" },
          ],
          fieldsSchema: {
            "root[].status": "string",
            "root[].created_at": "date",
          },
        },
        data: [],
      }],
      filters: [
        {
          id: "status_runtime_filter",
          fieldId: "status",
          operator: "is",
          value: "paid",
        },
        {
          id: "date_runtime_filter",
          type: "date",
          fieldId: "created_at",
          startDate: "2026-02-01T00:00:00.000Z",
          endDate: "2026-02-28T23:59:59.000Z",
        },
      ],
      variables: {},
    });

    expect(plan.filters).toEqual([
      {
        id: "status_runtime_filter",
        fieldId: "status",
        operator: "is",
        value: "paid",
        chartId: 12,
        cdcId: "cdc_scope",
        datasetId: 51,
        field: "root[].status",
      },
      {
        id: "v2_runtime_date_runtime_filter_start",
        field: "root[].created_at",
        operator: "greaterOrEqual",
        value: "2026-02-01T00:00:00.000Z",
        exposed: false,
        source: "v2_runtime",
        bindingId: null,
        filterId: "date_runtime_filter",
        chartId: 12,
        cdcId: "cdc_scope",
        datasetId: 51,
      },
      {
        id: "v2_runtime_date_runtime_filter_end",
        field: "root[].created_at",
        operator: "lessOrEqual",
        value: "2026-02-28T23:59:59.000Z",
        exposed: false,
        source: "v2_runtime",
        bindingId: null,
        filterId: "date_runtime_filter",
        chartId: 12,
        cdcId: "cdc_scope",
        datasetId: 51,
      },
    ]);
  });

  it("resolves scalar dashboard-filter bindings for V2 question filters", () => {
    const plan = buildVisualizationFilterPlan({
      chart: {
        id: 13,
        ChartDatasetConfigs: [{
          id: "cdc_scalar_binding",
          vizConfig: {
            filters: [{
              id: "region_question_filter",
              fieldId: "region",
              operator: "is",
              valueSource: "dashboardFilter",
              bindingId: "region_binding",
            }],
          },
        }],
      },
      datasets: [{
        options: {
          id: 61,
          cdcId: "cdc_scalar_binding",
          conditions: [],
          fieldsMetadata: [
            { id: "region", legacyPath: "root[].region", type: "string" },
          ],
          fieldsSchema: {
            "root[].region": "string",
          },
        },
        data: [],
      }],
      filters: [{
        id: "region_binding",
        fieldId: "region",
        operator: "is",
        value: "west",
      }],
      variables: {},
    });

    expect(plan.datasets[0].options.conditions).toEqual([{
      id: "v2_question_region_question_filter",
      field: "root[].region",
      operator: "is",
      value: "west",
      exposed: false,
      source: "v2_question",
      bindingId: "region_binding",
      filterId: "region_question_filter",
    }]);
  });

  it("resolves question-filter variables from persisted data-request defaults", () => {
    const plan = buildVisualizationFilterPlan({
      chart: {
        id: 14,
        ChartDatasetConfigs: [{
          id: "cdc_request_default_binding",
          vizConfig: {
            filters: [{
              id: "status_question_filter",
              fieldId: "status",
              operator: "is",
              valueSource: "variable",
              value: "{{status}}",
            }],
          },
        }],
      },
      datasets: [{
        options: {
          id: 71,
          cdcId: "cdc_request_default_binding",
          conditions: [],
          DataRequests: [{
            id: 5,
            VariableBindings: [{
              name: "status",
              type: "string",
              default_value: "pending",
            }],
          }],
          fieldsMetadata: [
            { id: "status", legacyPath: "root[].status", type: "string" },
          ],
          fieldsSchema: {
            "root[].status": "string",
          },
        },
        data: [],
      }],
      filters: [],
      variables: {},
    });

    expect(plan.datasets[0].options.conditions).toEqual([{
      id: "v2_question_status_question_filter",
      field: "root[].status",
      operator: "is",
      value: "pending",
      exposed: false,
      source: "v2_question",
      bindingId: null,
      filterId: "status_question_filter",
    }]);
    expect(plan.datasets[0].runtimeVariables).toEqual({
      status: "pending",
    });
  });

  it("supports explicit dashboard bindings for question filters and request variables while keeping scoped field filters", () => {
    const plan = buildVisualizationFilterPlan({
      chart: {
        id: 15,
        ChartDatasetConfigs: [{
          id: "cdc_bound_dashboard_filter",
          vizConfig: {
            filters: [{
              id: "status_question_filter",
              fieldId: "status",
              operator: "is",
              valueSource: "dashboardFilter",
              bindingId: "status_binding",
            }],
          },
        }],
      },
      datasets: [{
        options: {
          id: 72,
          cdcId: "cdc_bound_dashboard_filter",
          dateField: "root[].created_at",
          conditions: [],
          fieldsMetadata: [
            { id: "status", legacyPath: "root[].status", type: "string" },
            { id: "created_at", legacyPath: "root[].created_at", type: "date" },
          ],
          fieldsSchema: {
            "root[].status": "string",
            "root[].created_at": "date",
          },
        },
        data: [],
      }],
      filters: [{
        id: "dashboard_status_filter",
        type: "field",
        operator: "is",
        value: "paid",
        bindings: [{
          chartId: 15,
          cdcId: "cdc_bound_dashboard_filter",
          datasetId: 72,
          targetType: "questionFilter",
          bindingId: "status_binding",
        }],
      }, {
        id: "dashboard_date_range",
        type: "date",
        startDate: "2026-02-01T00:00:00.000Z",
        endDate: "2026-02-28T23:59:59.000Z",
        bindings: [{
          chartId: 15,
          cdcId: "cdc_bound_dashboard_filter",
          datasetId: 72,
          targetType: "field",
          fieldId: "created_at",
          operator: "between",
        }, {
          chartId: 15,
          cdcId: "cdc_bound_dashboard_filter",
          datasetId: 72,
          targetType: "variable",
          variableName: "startDate",
          role: "start",
        }, {
          chartId: 15,
          cdcId: "cdc_bound_dashboard_filter",
          datasetId: 72,
          targetType: "variable",
          variableName: "endDate",
          role: "end",
        }],
      }],
      variables: {},
    });

    expect(plan.datasets[0].options.conditions).toEqual([{
      id: "v2_question_status_question_filter",
      field: "root[].status",
      operator: "is",
      value: "paid",
      exposed: false,
      source: "v2_question",
      bindingId: "status_binding",
      filterId: "status_question_filter",
    }]);
    expect(plan.datasets[0].runtimeVariables).toEqual({
      startDate: "2026-02-01T00:00:00.000Z",
      endDate: "2026-02-28T23:59:59.000Z",
    });
    expect(plan.filters).toEqual([
      {
        id: "v2_runtime_dashboard_date_range_start",
        field: "root[].created_at",
        operator: "greaterOrEqual",
        value: "2026-02-01T00:00:00.000Z",
        exposed: false,
        source: "v2_runtime",
        bindingId: null,
        filterId: "dashboard_date_range",
        chartId: 15,
        cdcId: "cdc_bound_dashboard_filter",
        datasetId: 72,
      },
      {
        id: "v2_runtime_dashboard_date_range_end",
        field: "root[].created_at",
        operator: "lessOrEqual",
        value: "2026-02-28T23:59:59.000Z",
        exposed: false,
        source: "v2_runtime",
        bindingId: null,
        filterId: "dashboard_date_range",
        chartId: 15,
        cdcId: "cdc_bound_dashboard_filter",
        datasetId: 72,
      },
    ]);
  });
});
