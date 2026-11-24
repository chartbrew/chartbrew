import { afterEach, describe, expect, it, vi } from "vitest";

const ChartImageController = require("../../controllers/ChartImageController");
const { addImage, chartBlocks, loadChart, requestChartPreview } = require("../../apps/slack/charts");

const db = require("../../models/models");
const ChartController = require("../../controllers/ChartController");
const { withIntegrationContext } = require("../../modules/observations/integrationContext");

afterEach(() => vi.restoreAllMocks());

describe("Slack image delivery", () => {
  const preview = { chart: { id: 1, project_id: 2, name: "Revenue" }, preparedData: { results: [] }, filters: [{ type: "date" }] };
  const identity = { account: { user_id: 3 } };

  it("renders a filtered snapshot and rechecks access before a private upload", async () => {
    const render = vi.spyOn(ChartImageController.prototype, "render").mockResolvedValue(Buffer.from("png"));
    const uploadV2 = vi.fn().mockResolvedValue({ files: [{ files: [{ id: "F1" }] }] });
    const check = vi.fn();
    const result = await addImage(preview, identity, { files: { uploadV2 } }, "D1", check);
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ user: { id: 3 } }));
    expect(check).toHaveBeenCalledOnce();
    expect(check.mock.invocationCallOrder[0]).toBeLessThan(uploadV2.mock.invocationCallOrder[0]);
    expect(uploadV2).toHaveBeenCalledWith(expect.objectContaining({ channel_id: "D1", file: Buffer.from("png") }));
    expect(result.fileId).toBe("F1");
  });

  it("does not upload if access changes during rendering", async () => {
    vi.spyOn(ChartImageController.prototype, "render").mockResolvedValue(Buffer.from("png"));
    const uploadV2 = vi.fn();
    await addImage(preview, identity, { files: { uploadV2 } }, "D1", async () => { throw new Error("Access changed"); });
    expect(uploadV2).not.toHaveBeenCalled();
  });

  it("includes a chart link in both the card and plain-text fallback", () => {
    const result = chartBlocks({ ...preview, parsed: { visibility: "dashboard" } }, "request:0", { fallback: true });
    const link = result.blocks.find((block) => block.type === "actions").elements.find((element) => element.url);
    expect(link.url).toContain("/previews/1");
    expect(result.text).toContain(link.url);
  });

  it("keeps the chart link when rendering fails", async () => {
    vi.spyOn(ChartImageController.prototype, "render").mockRejectedValue(new Error("Unsupported"));
    const uploadV2 = vi.fn();
    expect(await addImage(preview, identity, { files: { uploadV2 } }, "D1", vi.fn())).toBe(preview);
    expect(uploadV2).not.toHaveBeenCalled();
  });
});

describe("Slack chart dates", () => {
  it.each([undefined, "", "Not/AZone"])("formats saved charts with timezone %s", (timezone) => {
    const blocks = chartBlocks({
      chart: { id: 1, name: "Revenue", timezone, render: {
        updatedAt: "2026-11-12T04:25:28.000Z",
        metadata: { timeRange: { start: "2026-11-01T00:00:00.000Z", end: "2026-11-12T00:00:00.000Z" } },
      } },
      parsed: { visibility: "dashboard" },
    }, "request:0").blocks;
    expect(blocks.find((block) => block.type === "context").elements[0].text)
      .toBe("1 Nov 2026 00:00 to 11 Nov 2026 23:59 (UTC) · Data updated: 12 Nov 2026 04:25 UTC");
  });

  it("keeps the dashboard timezone when a model-backed chart is saved as JSON", async () => {
    const chart = db.Chart.build({ id: 1, project_id: 2, name: "Revenue", type: "kpi" });
    const access = { teamId: 7, userId: 4, allProjects: false, projectIds: [2], role: "projectViewer" };
    vi.spyOn(db.Chart, "findByPk").mockResolvedValue({ id: 1, project_id: 2, Project: { team_id: 7, ghost: false }, ChartDatasetConfigs: [] });
    vi.spyOn(db.Chart, "unscoped").mockReturnValue({ findOne: vi.fn().mockResolvedValue(null) });
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({ timezone: "Asia/Bangkok" });
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role: "teamOwner" });
    vi.spyOn(ChartController.prototype, "findById").mockResolvedValue(chart);
    const preview = await withIntegrationContext({ integrationId: "integration", teamId: 7, userId: 4,
      resolveAccess: async () => access,
    }, () => loadChart(1, { account: { user_id: 4 }, access }));
    expect(JSON.parse(JSON.stringify(preview)).chart.timezone).toBe("Asia/Bangkok");
    await expect(withIntegrationContext({ teamId: 7, userId: 4, resolveAccess: async () => access }, () => (
      loadChart(1, { account: { user_id: 4 }, access }, { refresh: true, filters: [] })
    ))).rejects.toThrow("cannot refresh");
  });
});

describe("Explicit Slack chart previews", () => {
  it.each([false, true])("only requests a refresh when permitted (editor: %s)", async (canConfigureTeam) => {
    const chart = { id: 1, project_id: 2, name: "Token usage", type: "line" };
    const access = { teamId: 7, userId: 4, projectIds: [2], allProjects: false, canConfigureTeam };
    vi.spyOn(db.Chart, "findByPk").mockResolvedValue({ ...chart, Project: { team_id: 7, ghost: false }, ChartDatasetConfigs: [] });
    vi.spyOn(db.Chart, "unscoped").mockReturnValue({ findOne: vi.fn().mockResolvedValue(null) });
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({ timezone: "UTC" });
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role: "teamOwner" });
    vi.spyOn(ChartController.prototype, "findById").mockResolvedValue(chart);
    const result = await withIntegrationContext({ integrationId: "integration", teamId: 7, userId: 4,
      resolveAccess: async () => access,
    }, () => requestChartPreview({ chart_id: 1, refresh: true }));
    expect(result.chart_id).toBe(1);
    expect(result.refreshRequested).toBe(canConfigureTeam);
    const controls = chartBlocks({ chart, parsed: {}, canQuery: canConfigureTeam }, "request:0").blocks.at(-1).elements;
    expect(controls.some((control) => control.action_id === "slack_refresh")).toBe(canConfigureTeam);
    expect(controls.some((control) => control.action_id === "slack_data")).toBe(true);
    expect(result.guidance).toContain(canConfigureTeam ? "one-time update" : "cannot refresh");
  });

  it("does not expose the preview tool outside an integration", async () => {
    await expect(requestChartPreview({ chart_id: 1 })).rejects.toThrow("available in Slack");
  });
});
