import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");
const ChartController = require("../../controllers/ChartController.js");
const db = require("../../models/models");

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

function createSharedChartFixture() {
  const chart = createModel({
    id: 320,
    name: "Shared V2 chart",
    type: "bar",
    mode: "chart",
    project_id: 41,
    public: true,
    shareable: true,
    chartData: {
      data: {
        labels: ["original"],
        datasets: [{
          label: "Revenue",
          data: [3],
        }],
      },
    },
    ChartDatasetConfigs: [{
      id: "cdc_share_runtime",
      legend: "Revenue",
      vizVersion: 2,
      vizConfig: {
        version: 2,
      },
    }],
  });

  const embeddedTeam = {
    showBranding: true,
    allowReportExport: true,
    allowReportRefresh: true,
  };

  return {
    chart,
    embeddedTeam,
  };
}

describe("ChartController share/embed V2 parity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("treats share-string variable renders as runtime-only embedded responses", async () => {
    const controller = new ChartController();
    const { chart, embeddedTeam } = createSharedChartFixture();
    const updatedChart = {
      ...chart.toJSON(),
      chartData: {
        data: {
          labels: ["EMEA"],
          datasets: [{
            label: "Revenue",
            data: [12],
          }],
        },
      },
    };

    vi.spyOn(db.Chartshare, "findOne").mockResolvedValue({ chart_id: 320 });
    vi.spyOn(controller, "findById").mockResolvedValue(chart);
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({ id: 41, team_id: 77 });
    vi.spyOn(db.Team, "findByPk").mockResolvedValue(embeddedTeam);
    vi.spyOn(controller, "updateChartData").mockResolvedValue(updatedChart);

    const result = await controller.findByShareString("share-public-v2", {
      region: "EMEA",
      theme: "dark",
      token: "ignored",
      isSnapshot: false,
    });

    expect(controller.updateChartData).toHaveBeenCalledWith(
      320,
      null,
      expect.objectContaining({
        variables: {
          region: "EMEA",
        },
        getCache: false,
        skipSave: true,
      }),
    );
    expect(result.chartData.data.labels).toEqual(["EMEA"]);
    expect(result.chartData.data.datasets[0].data).toEqual([12]);
    expect(result.ChartDatasetConfigs[0].vizVersion).toBe(2);
  });

  it("merges share-policy params with URL params without persisting filtered chartData", async () => {
    const controller = new ChartController();
    const { chart, embeddedTeam } = createSharedChartFixture();
    const updatedChart = {
      ...chart.toJSON(),
      chartData: {
        data: {
          labels: ["North America"],
          datasets: [{
            label: "Revenue",
            data: [24],
          }],
        },
      },
    };

    vi.spyOn(jwt, "verify").mockReturnValue({
      sub: {
        type: "Chart",
        id: 320,
      },
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    vi.spyOn(db.SharePolicy, "findOne").mockResolvedValue({
      entity_id: 320,
      params: [
        { key: "account_id", value: "123" },
        { key: "region", value: "EMEA" },
      ],
      allow_params: true,
    });
    vi.spyOn(controller, "findById").mockResolvedValue(chart);
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({ id: 41, team_id: 77 });
    vi.spyOn(db.Team, "findByPk").mockResolvedValue(embeddedTeam);
    vi.spyOn(controller, "updateChartData").mockResolvedValue(updatedChart);

    const result = await controller.findBySharePolicy("share-policy-v2", {
      token: "signed-token",
      account_id: "999",
      theme: "light",
    });

    expect(controller.updateChartData).toHaveBeenCalledWith(
      320,
      null,
      expect.objectContaining({
        variables: {
          account_id: "999",
          region: "EMEA",
        },
        getCache: false,
        skipSave: true,
      }),
    );
    expect(result.chartData.data.labels).toEqual(["North America"]);
    expect(result.chartData.data.datasets[0].data).toEqual([24]);
  });

  it("accepts isSnapshot on the embedded route and resolves the chart by snapshot token", async () => {
    const controller = new ChartController();
    const snapshotChart = createModel({
      id: 901,
      chartData: {
        data: {
          labels: ["Snapshot"],
          datasets: [],
        },
      },
    });

    vi.spyOn(db.Chart, "findOne").mockResolvedValue({ id: 901 });
    vi.spyOn(controller, "findById").mockResolvedValue(snapshotChart);
    const updateSpy = vi.spyOn(controller, "updateChartData");

    const result = await controller.findByShareString("snapshot-token-v2", {
      isSnapshot: true,
    });

    expect(db.Chart.findOne).toHaveBeenCalledWith({
      where: {
        snapshotToken: "snapshot-token-v2",
      },
    });
    expect(controller.findById).toHaveBeenCalledWith(901);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(result).toBe(snapshotChart);
  });
});
