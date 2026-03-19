import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ChartController = require("../../controllers/ChartController.js");
const db = require("../../models/models");
const { legacyToVizConfig } = require("../../modules/visualizationV2/legacyToVizConfig.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createModel(initialValues = {}) {
  const model = {
    ...clone(initialValues),
    dataValues: {},
    toJSON() {
      const plain = { ...model };
      delete plain.toJSON;
      delete plain.setDataValue;
      delete plain.getDataValue;
      delete plain.dataValues;
      return clone({
        ...plain,
        ...model.dataValues,
      });
    },
    setDataValue(key, value) {
      model.dataValues[key] = value;
      model[key] = value;
    },
    getDataValue(key) {
      if (Object.prototype.hasOwnProperty.call(model.dataValues, key)) {
        return model.dataValues[key];
      }

      return model[key];
    },
  };

  return model;
}

function createV2BarFixture({ conditions = [] } = {}) {
  const fieldsMetadata = [
    {
      id: "status",
      legacyPath: "root[].status",
      type: "string",
      label: "Status",
    },
    {
      id: "value",
      legacyPath: "root[].value",
      type: "number",
      label: "Value",
    },
  ];

  const migration = legacyToVizConfig({
    chart: {
      id: 310,
      type: "bar",
      mode: "chart",
    },
    dataset: {
      id: 410,
      xAxis: "root[].status",
      yAxis: "root[].value",
      yAxisOperation: "sum",
      fieldsMetadata,
      conditions,
    },
    cdc: {
      id: "cdc_update_v2",
      dataset_id: 410,
      legend: "Revenue",
      vizVersion: 2,
    },
  });

  const chart = createModel({
    id: 310,
    type: "bar",
    mode: "chart",
    project_id: 1,
    ChartDatasetConfigs: [{
      id: "cdc_update_v2",
      dataset_id: 410,
      legend: "Revenue",
      vizVersion: 2,
      vizConfig: migration.vizConfig,
      Dataset: {
        id: 410,
        conditions: clone(conditions),
      },
    }],
  });

  const datasetResponse = {
    options: {
      id: 410,
      name: "Revenue dataset",
      conditions: clone(conditions),
      fieldsMetadata,
      fieldsSchema: {
        "root[].status": "string",
        "root[].value": "number",
      },
    },
    data: [
      { status: "paid", value: 4 },
      { status: "pending", value: 3 },
      { status: "paid", value: 5 },
    ],
  };

  return {
    chart,
    datasetResponse,
  };
}

describe("ChartController.updateChartData V2", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists V2 chartData and dataset condition values on normal runs", async () => {
    const controller = new ChartController();
    const datasetCondition = {
      id: "dataset_status_filter",
      field: "root[].status",
      operator: "is",
      value: "paid",
      exposed: true,
    };
    const { chart, datasetResponse } = createV2BarFixture({
      conditions: [datasetCondition],
    });

    vi.spyOn(controller, "findById")
      .mockResolvedValueOnce(chart)
      .mockResolvedValueOnce(chart);
    vi.spyOn(controller, "update").mockImplementation(async (_id, data) => {
      Object.assign(chart, data);
      return chart;
    });
    vi.spyOn(controller.datasetController, "runRequest").mockResolvedValue(datasetResponse);
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({ id: 1, timezone: "UTC" });
    const datasetUpdateSpy = vi.spyOn(db.Dataset, "update").mockResolvedValue([1]);

    const result = await controller.updateChartData(310, null, {});

    expect(controller.update).toHaveBeenCalledTimes(2);
    expect(controller.update).toHaveBeenNthCalledWith(
      2,
      310,
      expect.objectContaining({
        chartData: expect.objectContaining({
          data: expect.objectContaining({
            labels: ["paid"],
          }),
        }),
      }),
    );
    expect(datasetUpdateSpy).toHaveBeenCalledWith(
      {
        conditions: [{
          ...datasetCondition,
          values: ["paid", "pending"],
        }],
      },
      { where: { id: 410 } },
    );
    expect(result.chartData.data.labels).toEqual(["paid"]);
    expect(result.chartData.data.datasets[0].data).toEqual([9]);
    expect(result.getDataValue("isTimeseries")).toBe(false);
  });

  it("returns filtered V2 chart data without persisting chartData or condition values", async () => {
    const controller = new ChartController();
    const { chart, datasetResponse } = createV2BarFixture();

    vi.spyOn(controller, "findById").mockResolvedValue(chart);
    vi.spyOn(controller, "update").mockImplementation(async (_id, data) => {
      Object.assign(chart, data);
      return chart;
    });
    vi.spyOn(controller.datasetController, "runRequest").mockResolvedValue(datasetResponse);
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({ id: 1, timezone: "UTC" });
    const datasetUpdateSpy = vi.spyOn(db.Dataset, "update").mockResolvedValue([1]);

    const result = await controller.updateChartData(310, null, {
      filters: [{
        id: "status_runtime_filter",
        fieldId: "status",
        operator: "is",
        value: "paid",
      }],
    });

    expect(controller.update).toHaveBeenCalledTimes(1);
    expect(controller.update).toHaveBeenCalledWith(
      310,
      expect.objectContaining({
        chartDataUpdated: expect.any(Object),
      }),
    );
    expect(datasetUpdateSpy).not.toHaveBeenCalled();
    expect(result.chartData.data.labels).toEqual(["paid"]);
    expect(result.chartData.data.datasets[0].data).toEqual([9]);
    expect(result.getDataValue("isTimeseries")).toBe(false);
  });

  it("returns V2 export rows without persisting chartData or dataset condition values", async () => {
    const controller = new ChartController();
    const { chart, datasetResponse } = createV2BarFixture();

    vi.spyOn(controller, "findById").mockResolvedValue(chart);
    vi.spyOn(controller, "update").mockImplementation(async (_id, data) => {
      Object.assign(chart, data);
      return chart;
    });
    vi.spyOn(controller.datasetController, "runRequest").mockResolvedValue(datasetResponse);
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({ id: 1, timezone: "UTC" });
    const datasetUpdateSpy = vi.spyOn(db.Dataset, "update").mockResolvedValue([1]);

    const result = await controller.updateChartData(310, null, {
      isExport: true,
    });

    expect(controller.update).toHaveBeenCalledTimes(1);
    expect(datasetUpdateSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      Revenue: [
        { status: "paid", value: 4 },
        { status: "pending", value: 3 },
        { status: "paid", value: 5 },
      ],
    });
  });

  it("keeps reused datasets scoped per cdc when V2 question filters rely on cdc default variables", async () => {
    const controller = new ChartController();
    const fieldsMetadata = [
      {
        id: "step",
        legacyPath: "root[].step",
        type: "string",
        label: "Step",
      },
      {
        id: "status",
        legacyPath: "root[].status",
        type: "string",
        label: "Status",
      },
      {
        id: "value",
        legacyPath: "root[].value",
        type: "number",
        label: "Value",
      },
    ];

    const vizConfig = {
      version: 2,
      dimensions: [{
        id: "dimension_step",
        fieldId: "step",
        role: "x",
      }],
      metrics: [{
        id: "metric_value",
        fieldId: "value",
        aggregation: "sum",
        label: "Revenue",
        axis: "left",
        enabled: true,
        style: {
          color: "#2563eb",
          fillColor: "transparent",
          lineStyle: "solid",
          pointRadius: 0,
          goal: null,
        },
      }],
      filters: [{
        id: "status_question_filter",
        fieldId: "status",
        operator: "is",
        valueSource: "variable",
        value: "{{selected_status}}",
      }],
      filterControls: [],
      sort: [],
      limit: null,
      postOperations: [],
      options: {
        includeEmptyBuckets: true,
        visualization: {
          type: "bar",
          dataMode: "series",
        },
        compatibility: {
          legacyRawChartType: "bar",
          legacyChartType: "bar",
          legacyDimensionFieldId: "step",
          legacyMetricFieldId: "value",
        },
      },
    };

    const sharedDataset = {
      options: {
        id: 450,
        name: "Shared dataset",
        conditions: [],
        fieldsMetadata,
        fieldsSchema: {
          "root[].step": "string",
          "root[].status": "string",
          "root[].value": "number",
        },
      },
      data: [
        { step: "A", status: "paid", value: 10 },
        { step: "B", status: "paid", value: 30 },
        { step: "A", status: "pending", value: 5 },
        { step: "B", status: "pending", value: 15 },
      ],
    };

    const chart = createModel({
      id: 311,
      type: "bar",
      mode: "chart",
      project_id: 1,
      ChartDatasetConfigs: [
        {
          id: "cdc_paid",
          dataset_id: 450,
          legend: "Paid revenue",
          vizVersion: 2,
          vizConfig,
          configuration: {
            variables: [{
              name: "selected_status",
              value: "paid",
            }],
          },
          Dataset: {
            id: 450,
            conditions: [],
          },
        },
        {
          id: "cdc_pending",
          dataset_id: 450,
          legend: "Pending revenue",
          vizVersion: 2,
          vizConfig,
          configuration: {
            variables: [{
              name: "selected_status",
              value: "pending",
            }],
          },
          Dataset: {
            id: 450,
            conditions: [],
          },
        },
      ],
    });

    vi.spyOn(controller, "findById")
      .mockResolvedValueOnce(chart)
      .mockResolvedValueOnce(chart);
    vi.spyOn(controller, "update").mockImplementation(async (_id, data) => {
      Object.assign(chart, data);
      return chart;
    });
    vi.spyOn(controller.datasetController, "runRequest")
      .mockResolvedValueOnce(clone(sharedDataset))
      .mockResolvedValueOnce(clone(sharedDataset));
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({ id: 1, timezone: "UTC" });
    vi.spyOn(db.Dataset, "update").mockResolvedValue([1]);

    const result = await controller.updateChartData(311, null, {});

    expect(result.chartData.data.labels).toEqual(["A", "B"]);
    expect(result.chartData.data.datasets).toHaveLength(2);
    expect(result.chartData.data.datasets[0]).toMatchObject({
      label: "Paid revenue",
      data: [10, 30],
    });
    expect(result.chartData.data.datasets[1]).toMatchObject({
      label: "Pending revenue",
      data: [5, 15],
    });
  });
});
