import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const runtimePath = require.resolve("../../modules/visualizationV2/runtime.js");
const axisChartPath = require.resolve("../../charts/AxisChart.js");
const chartControllerPath = require.resolve("../../controllers/ChartController.js");
const db = require("../../models/models");

function loadLegacyController({ axisChartImplementation, runtimeImplementation }) {
  const runtimeModule = require(runtimePath);
  const axisChartModule = require(axisChartPath);
  const originalRunVisualizationV2 = runtimeModule.runVisualizationV2;
  const originalAxisChart = axisChartModule;

  require.cache[runtimePath].exports = {
    ...runtimeModule,
    runVisualizationV2: runtimeImplementation,
  };
  require.cache[axisChartPath].exports = axisChartImplementation;
  delete require.cache[chartControllerPath];

  const ChartController = require(chartControllerPath);

  return {
    ChartController,
    restore() {
      require.cache[runtimePath].exports = runtimeModule;
      require.cache[axisChartPath].exports = originalAxisChart;
      delete require.cache[chartControllerPath];
    },
  };
}

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

describe("ChartController legacy update parity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete require.cache[chartControllerPath];
  });

  it("keeps legacy charts on the AxisChart path", async () => {
    const axisChartPlot = vi.fn().mockResolvedValue({
      configuration: {
        data: {
          labels: ["paid"],
          datasets: [{
            label: "Revenue",
            data: [9],
          }],
        },
      },
      isTimeseries: false,
      dateFormat: null,
    });

    const loader = loadLegacyController({
      axisChartImplementation: class AxisChart {
        plot(...args) {
          return axisChartPlot(...args);
        }
      },
      runtimeImplementation: vi.fn(() => {
        throw new Error("V2 runtime should not execute for legacy charts");
      }),
    });
    const controller = new loader.ChartController();
    const chart = createModel({
      id: 900,
      type: "bar",
      mode: "chart",
      project_id: 1,
      ChartDatasetConfigs: [{
        id: "legacy_cdc",
        dataset_id: 410,
        legend: "Revenue",
        vizVersion: 1,
        Dataset: {
          id: 410,
          conditions: [],
        },
      }],
    });

    vi.spyOn(controller, "findById")
      .mockResolvedValueOnce(chart)
      .mockResolvedValueOnce(chart);
    vi.spyOn(controller, "update").mockImplementation(async (_id, data) => {
      Object.assign(chart, data);
      return chart;
    });
    vi.spyOn(controller.datasetController, "runRequest").mockResolvedValue({
      options: {
        id: 410,
        name: "Revenue dataset",
        conditions: [],
        xAxis: "root[].status",
        yAxis: "root[].value",
      },
      data: [
        { status: "paid", value: 4 },
        { status: "paid", value: 5 },
      ],
    });
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({ id: 1, timezone: "UTC" });
    vi.spyOn(db.Dataset, "update").mockResolvedValue([1]);

    const result = await controller.updateChartData(900, null, {});

    expect(axisChartPlot).toHaveBeenCalled();
    expect(result.chartData.data.labels).toEqual(["paid"]);
    expect(result.chartData.data.datasets[0].data).toEqual([9]);

    loader.restore();
  });
});
