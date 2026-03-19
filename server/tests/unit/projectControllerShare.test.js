import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ProjectController = require("../../controllers/ProjectController.js");
const ChartController = require("../../controllers/ChartController.js");

function createProjectModel(initialValues = {}) {
  const project = {
    ...initialValues,
    toJSON() {
      return JSON.parse(JSON.stringify(initialValues));
    },
  };

  return project;
}

describe("ProjectController public/share runtime inputs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes public dashboard field filters separately from runtime variables", () => {
    const { normalizePublicRuntimeInputs } = require("../../controllers/ProjectController.js");

    const result = normalizePublicRuntimeInputs({
      account_id: "123",
      "__field_root[].status": "paid",
      "__field_root[].region": "west",
      empty: "",
    });

    expect(result).toEqual({
      variables: {
        account_id: "123",
        empty: "",
      },
      filters: [{
        id: "public_field_root[].status",
        field: "root[].status",
        operator: "is",
        value: "paid",
        source: "public_dashboard_url",
      }, {
        id: "public_field_root[].region",
        field: "root[].region",
        operator: "is",
        value: "west",
        source: "public_dashboard_url",
      }],
    });
  });

  it("applies public dashboard field filters through updateChartData without persisting", async () => {
    const controller = new ProjectController();
    const project = createProjectModel({
      id: 91,
      Charts: [{
        id: 501,
      }, {
        id: 502,
      }],
    });
    const updatedCharts = [{
      id: 501,
      chartData: {
        data: {
          labels: ["paid"],
        },
      },
    }, {
      id: 502,
      chartData: {
        data: {
          labels: ["paid"],
        },
      },
    }];

    const updateChartData = vi.fn()
      .mockResolvedValueOnce(updatedCharts[0])
      .mockResolvedValueOnce(updatedCharts[1]);

    vi.spyOn(ChartController.prototype, "updateChartData").mockImplementation(updateChartData);

    const result = await controller.applyVariablesToCharts(project, {
      "__field_root[].status": "paid",
      region_var: "west",
    });

    expect(ChartController.prototype.updateChartData).toHaveBeenNthCalledWith(
      1,
      501,
      null,
      {
        noSource: false,
        skipParsing: false,
        variables: {
          region_var: "west",
        },
        filters: [{
          id: "public_field_root[].status",
          field: "root[].status",
          operator: "is",
          value: "paid",
          source: "public_dashboard_url",
        }],
        getCache: false,
        skipSave: true,
      },
    );
    expect(ChartController.prototype.updateChartData).toHaveBeenNthCalledWith(
      2,
      502,
      null,
      {
        noSource: false,
        skipParsing: false,
        variables: {
          region_var: "west",
        },
        filters: [{
          id: "public_field_root[].status",
          field: "root[].status",
          operator: "is",
          value: "paid",
          source: "public_dashboard_url",
        }],
        getCache: false,
        skipSave: true,
      },
    );
    expect(result.Charts).toEqual(updatedCharts);
  });
});
