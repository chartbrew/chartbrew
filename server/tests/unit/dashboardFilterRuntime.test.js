import { describe, expect, it } from "vitest";

const {
  buildProcessedChartFilters,
  getActiveDateFilters,
  getChartIdentifiedConditions,
  getClearedVariableFilters,
  getApplicableDashboardFiltersForChart,
  getDashboardVariables,
  getLegacyVariableConditions,
  getProjectFilters,
} = await import(new URL("../../../client/src/modules/dashboardFilterRuntime.js", import.meta.url));

describe("dashboardFilterRuntime", () => {
  it("returns project-scoped filters only", () => {
    const filters = {
      10: [{ id: "project-10-filter" }],
      20: [{ id: "project-20-filter" }],
    };

    expect(getProjectFilters(filters, 10)).toEqual([{ id: "project-10-filter" }]);
    expect(getProjectFilters(filters, 30)).toEqual([]);
  });

  it("extracts only active dashboard variables", () => {
    expect(getDashboardVariables([
      {
        id: "region", type: "variable", variable: "region", value: "emea"
      },
      {
        id: "include_zeroes", type: "variable", variable: "include_zeroes", value: false
      },
      {
        id: "ignored", type: "variable", variable: "empty_value", value: ""
      },
      {
        id: "field_filter", type: "field", field: "root.region", value: "emea"
      },
    ])).toEqual({
      region: "emea",
      include_zeroes: false,
    });
  });

  it("flattens chart conditions once per identifiable condition", () => {
    const conditions = getChartIdentifiedConditions({
      ChartDatasetConfigs: [{
        Dataset: {
          conditions: [
            { id: "condition_1", field: "root[].region", variable: "region" },
            { id: "condition_1", field: "root[].region", variable: "region" },
            { id: "condition_2", field: "root[].created_at", variable: "created_at" },
          ],
        },
      }],
    });

    expect(conditions).toEqual([
      { id: "condition_1", field: "root[].region", variable: "region" },
      { id: "condition_2", field: "root[].created_at", variable: "created_at" },
    ]);
  });

  it("finds variable filters that were cleared from a previously active state", () => {
    const currentFilters = [
      {
        id: "region", type: "variable", variable: "region", value: ""
      },
      {
        id: "team", type: "variable", variable: "team", value: "marketing"
      },
    ];
    const previousFilters = [
      {
        id: "region", type: "variable", variable: "region", value: "emea"
      },
      {
        id: "team", type: "variable", variable: "team", value: "marketing"
      },
    ];

    expect(getClearedVariableFilters(currentFilters, previousFilters)).toEqual([
      {
        id: "region", type: "variable", variable: "region", value: ""
      },
    ]);
  });

  it("maps variable filters back to legacy chart conditions", () => {
    const variableFilters = [
      {
        id: "region_filter", type: "variable", variable: "region", value: "emea"
      },
      {
        id: "created_filter", type: "variable", variable: "created_after", value: ""
      },
    ];
    const identifiedConditions = [
      {
        id: "condition_region",
        field: "root[].region",
        operator: "is",
        variable: "region",
      },
      {
        id: "condition_created",
        field: "root[].created_at",
        operator: "greaterOrEqual",
        value: "{{created_after}}",
      },
    ];

    expect(getLegacyVariableConditions(variableFilters, identifiedConditions)).toEqual([
      {
        id: "condition_region",
        field: "root[].region",
        operator: "is",
        variable: "region",
        value: "emea",
        filterId: "region_filter",
      },
      {
        id: "condition_created",
        field: "root[].created_at",
        operator: "greaterOrEqual",
        value: "",
        filterId: "created_filter",
      },
    ]);
  });

  it("keeps active and just-cleared date filters so charts rerender once", () => {
    const currentFilters = [
      {
        id: "active_date",
        type: "date",
        startDate: "2026-03-01T00:00:00Z",
        endDate: "2026-03-10T23:59:59Z",
      },
      {
        id: "cleared_date",
        type: "date",
        startDate: "",
        endDate: "",
      },
    ];
    const previousFilters = [
      {
        id: "cleared_date",
        type: "date",
        startDate: "2026-02-01T00:00:00Z",
        endDate: "2026-02-10T23:59:59Z",
      },
    ];

    expect(getActiveDateFilters(currentFilters, previousFilters)).toEqual(currentFilters);
  });

  it("builds processed chart filters from active field filters and legacy variable bridges", () => {
    const chart = {
      ChartDatasetConfigs: [{
        Dataset: {
          conditions: [{
            id: "condition_region",
            field: "root[].region",
            operator: "is",
            variable: "region",
          }],
        },
      }],
    };

    const currentFilters = [
      {
        id: "field_status",
        type: "field",
        field: "root[].status",
        operator: "is",
        value: "",
      },
      {
        id: "region_filter",
        type: "variable",
        variable: "region",
        value: "",
      },
    ];
    const previousFilters = [
      {
        id: "field_status",
        type: "field",
        field: "root[].status",
        operator: "is",
        value: "paid",
      },
      {
        id: "region_filter",
        type: "variable",
        variable: "region",
        value: "emea",
      },
    ];

    expect(buildProcessedChartFilters({
      chart,
      currentFilters,
      previousFilters,
    })).toEqual({
      processedFilters: [
        {
          id: "field_status",
          type: "field",
          field: "root[].status",
          operator: "is",
          value: "",
        },
        {
          id: "condition_region",
          field: "root[].region",
          operator: "is",
          variable: "region",
          value: "",
          filterId: "region_filter",
        },
      ],
    });
  });

  it("normalizes dashboard filters bound to V2 question filters", () => {
    const chart = {
      id: 15,
      ChartDatasetConfigs: [{
        id: "cdc_bound_dashboard_filter",
        dataset_id: 72,
        Dataset: {
          id: 72,
          fieldsMetadata: [
            { id: "status", legacyPath: "root[].status", type: "string" },
          ],
        },
      }],
    };

    expect(getApplicableDashboardFiltersForChart([{
      id: "dashboard_status_filter",
      type: "field",
      operator: "is",
      value: "paid",
      bindings: [{
        chartId: 15,
        cdcId: "cdc_bound_dashboard_filter",
        datasetId: 72,
        targetType: "questionFilter",
        fieldId: "status",
        legacyPath: "root[].status",
        bindingId: "status_binding",
        filterId: "status_question_filter",
      }],
    }], chart)).toEqual([expect.objectContaining({
      id: "dashboard_status_filter",
      type: "field",
      targetType: "questionFilter",
      fieldId: "status",
      field: "root[].status",
      bindingId: "status_binding",
      filterId: "status_question_filter",
      value: "paid",
    })]);
  });
});
