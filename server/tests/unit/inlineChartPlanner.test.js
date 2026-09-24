import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const orchestrator = require("../../modules/ai/orchestrator/orchestrator");
const originalProvider = orchestrator.getChartCreationProvider;
const create = vi.fn();
orchestrator.getChartCreationProvider = () => ({ client: { responses: { create } }, model: "test" });
const { planInlineChart } = require("../../modules/ai/orchestrator/inlineChart");
orchestrator.getChartCreationProvider = originalProvider;
const { VisualizationEngine } = require("../../visualization/VisualizationEngine");

const response = (name, args) => ({ output: [{ type: "function_call", name, arguments: JSON.stringify(args), call_id: `call-${create.mock.calls.length}` }] });
const mapPlan = (field) => ({ name: "Visits around the world", type: "map", dataset_id: 20,
  visualization: { version: 2, layers: [{ id: "visits", bindingId: "binding-1", mark: "map",
    encoding: { location: { field }, value: { field: "root[].visits", aggregate: "sum" } },
    options: { map: { area: "world", mode: "regions" } } }] } });
const context = () => ({ access: { canConfigureTeam: true, teamId: 7 }, input: { prompt: "Map visits around the world in the last 30 days" },
  checkActive: async () => 120000, inspectDataset: vi.fn().mockResolvedValue({}), runScopedTool: vi.fn().mockResolvedValue({}) });

afterEach(() => create.mockReset());
beforeEach(() => {
  create.mockResolvedValueOnce(response("inspect_dataset", { dataset_id: 20 }));
});

describe("inline chart planning", () => {
  it("continues after the model asks how to name the chart", async () => {
    create.mockReset();
    create.mockResolvedValueOnce(response("ask_chart_question", {
      question: "Should the chart title include the source name Internal DB?",
    })).mockResolvedValueOnce(response("prepare_chart", { name: "Chart creations in the last 90 days", type: "line", connection_id: 40 }));
    const prepareChart = vi.fn();
    const result = await planInlineChart({ ...context(),
      input: { prompt: "Create a time series of charts created in the last 90 days" }, prepareChart });
    expect(result.question).toBeUndefined();
    expect(result.plan.name).toBe("Chart creations in the last 90 days");
    expect(prepareChart).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[1][0].input).toContainEqual(expect.objectContaining({
      output: expect.stringContaining("Choose the chart title"),
    }));
  });

  it("still asks when the metric meaning is unclear", async () => {
    create.mockReset();
    create.mockResolvedValueOnce(response("ask_chart_question", {
      question: "Do you mean charts created or chart views?",
    }));
    const result = await planInlineChart({ ...context(), input: { prompt: "Show chart activity" } });
    expect(result.question).toBe("Do you mean charts created or chart views?");
  });

  it("requires source query review before accepting a saved dataset", async () => {
    create.mockReset();
    create.mockResolvedValueOnce(response("prepare_chart", mapPlan("root[].country")))
      .mockResolvedValueOnce(response("prepare_chart", { ...mapPlan("root[].country_code"), dataset_id: undefined, connection_id: 40 }));
    const inspectDataset = vi.fn().mockResolvedValue({ sourceQueries: ["SELECT country_name, count(*) FROM all_events GROUP BY country_name"] });
    const prepareChart = vi.fn();
    const result = await planInlineChart({ ...context(), inspectDataset, prepareChart });
    expect(inspectDataset).toHaveBeenCalledWith(20);
    expect(prepareChart).toHaveBeenCalledTimes(1);
    expect(result.plan.connection_id).toBe(40);
    expect(create.mock.calls[1][0].input).toContainEqual(expect.objectContaining({ output: expect.stringContaining("sourceQueries") }));
  });

  it("rejects a bar for an explicit map request and searches sources before asking", async () => {
    create.mockResolvedValueOnce(response("prepare_chart", { ...mapPlan("root[].region"), type: "bar" }))
      .mockResolvedValueOnce(response("ask_chart_question", { question: "Is there another dataset?" }))
      .mockResolvedValueOnce(response("get_schema", { connection_id: 40 }))
      .mockResolvedValueOnce(response("prepare_chart", mapPlan("root[].country_code")));
    const prepareChart = vi.fn();
    const runScopedTool = vi.fn().mockResolvedValue({ connections: [{ id: 40, name: "Website analytics" }] });
    const result = await planInlineChart({ ...context(), prepareChart, runScopedTool });
    expect(prepareChart).toHaveBeenCalledTimes(1);
    expect(result.plan.type).toBe("map");
    expect(JSON.parse(create.mock.calls[0][0].input[0].content).connections.connections[0].id).toBe(40);
    expect(runScopedTool).toHaveBeenCalledWith("get_schema", { connection_id: 40 }, expect.any(Function));
  });

  it("corrects an empty map using renderer feedback before finishing", async () => {
    create.mockResolvedValueOnce(response("prepare_chart", mapPlan("root[].city")))
      .mockResolvedValueOnce(response("prepare_chart", mapPlan("root[].country")));
    const prepareChart = vi.fn(async (plan) => {
      const rendered = new VisualizationEngine({ chart: plan,
        datasets: [{ bindingId: "binding-1", data: [{ city: "London", country: "GB", visits: 12 }] }],
      }).render();
      if (!rendered.preparedData.results[0].rows.length) throw new Error("Locations do not match the world map. Check the location field.");
    });
    const result = await planInlineChart({ ...context(), prepareChart });
    expect(prepareChart).toHaveBeenCalledTimes(2);
    expect(result.plan.visualization.layers[0].encoding.location.field).toBe("root[].country");
    const request = create.mock.calls[1][0];
    expect(request.input).toContainEqual(expect.objectContaining({ type: "function_call_output", output: expect.stringContaining("Locations do not match") }));
    expect(request.tools.find((tool) => tool.name === "prepare_chart").parameters.properties.type.enum).toContain("map");
    expect(request.instructions).toContain("visualization.layers[0].options.map");
  });

  it("can inspect connections after a dataset fails without asking the user", async () => {
    const sourcePlan = { ...mapPlan("root[].country"), dataset_id: undefined, connection_id: 40 };
    create.mockResolvedValueOnce(response("prepare_chart", mapPlan("root[].country")))
      .mockResolvedValueOnce(response("list_connections", {}))
      .mockResolvedValueOnce(response("prepare_chart", sourcePlan));
    const prepareChart = vi.fn().mockRejectedValueOnce(new Error("The saved dataset has no data for the requested period.")).mockResolvedValueOnce(undefined);
    const runScopedTool = vi.fn().mockResolvedValue({ connections: [{ id: 40, name: "Website analytics" }] });
    const result = await planInlineChart({ ...context(), runScopedTool, prepareChart });
    expect(runScopedTool).toHaveBeenCalledWith("list_connections", {}, expect.any(Function));
    expect(result.plan.connection_id).toBe(40);
    expect(result.question).toBeUndefined();
  });
});
