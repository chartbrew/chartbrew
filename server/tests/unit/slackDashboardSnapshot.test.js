import { afterEach, describe, expect, it, vi } from "vitest";

const fs = require("node:fs/promises");
const db = require("../../models/models");
const snapshots = require("../../modules/snapshots");
const { withIntegrationContext } = require("../../modules/observations/integrationContext");
const { requestDashboardSnapshot, sendDashboardSnapshot } = require("../../apps/slack/dashboardSnapshot");
const { availableTools } = require("../../modules/ai/orchestrator/orchestrator");

const access = { teamId: 7, userId: 4, projectIds: [2], allProjects: false };
const identity = { access, account: { user_id: 4 } };
const context = { teamId: 7, userId: 4, integrationId: "integration", resolveAccess: async () => access,
  resolveSnapshotProjectIds: async () => [2] };

function mockDashboard() {
  vi.spyOn(db.Project, "findOne").mockResolvedValue({ id: 2, name: "Product metrics" });
  vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role: "teamOwner" });
  vi.spyOn(db.Chart, "findAll").mockResolvedValue([]);
}

afterEach(() => vi.restoreAllMocks());

describe("Slack dashboard snapshots", () => {
  it("offers screenshot requests only inside the integration worker", async () => {
    expect((await availableTools()).some((tool) => tool.name === "request_dashboard_snapshot")).toBe(false);
    const tools = await withIntegrationContext(context, () => availableTools());
    expect(tools.some((tool) => tool.name === "request_dashboard_snapshot")).toBe(true);
  });

  it("uses the last dashboard discussed when no target is supplied", async () => {
    mockDashboard();
    const result = await withIntegrationContext(context, () => requestDashboardSnapshot({}));
    expect(result).toEqual({ projectId: 2, name: "Product metrics", status: "ready_for_delivery" });
    expect(db.Project.findOne).toHaveBeenCalledWith({ where: { id: 2, team_id: 7, ghost: false } });
  });

  it("asks for a dashboard when the previous turn covered multiple dashboards", async () => {
    const result = await withIntegrationContext({ ...context, resolveSnapshotProjectIds: async () => [2, 3] },
      () => requestDashboardSnapshot({}));
    expect(result.error).toContain("Ask which dashboard");
  });

  it("rejects dashboards outside the linked account scope", async () => {
    await expect(withIntegrationContext(context, () => requestDashboardSnapshot({ project_id: 3 }))).rejects.toThrow(/access/i);
  });

  it("respects export permission for linked clients", async () => {
    mockDashboard();
    db.TeamRole.findOne.mockResolvedValue({ role: "projectViewer", projects: [2], canExport: false });
    await expect(withIntegrationContext(context, () => requestDashboardSnapshot({ project_id: 2 })))
      .rejects.toThrow("cannot export");
  });

  it("uploads one dashboard image in the source thread and removes the local file", async () => {
    mockDashboard();
    vi.spyOn(snapshots, "snapDashboard").mockResolvedValue("uploads/snapshots/test.png");
    vi.spyOn(fs, "readFile").mockResolvedValue(Buffer.from("png"));
    const remove = vi.spyOn(fs, "unlink").mockResolvedValue();
    const uploadV2 = vi.fn().mockResolvedValue({ files: [{ id: "F1" }] });
    const check = vi.fn().mockResolvedValue(identity);
    const result = await withIntegrationContext(context, () => sendDashboardSnapshot({ projectId: 2 },
      { files: { uploadV2 } }, "C1", "original", check));
    expect(result).toBe("F1");
    expect(uploadV2).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ channel_id: "C1", thread_ts: "original", filename: "dashboard.png" }));
    expect(check).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledOnce();
  });

  it("does not upload after access is revoked during rendering", async () => {
    mockDashboard();
    vi.spyOn(snapshots, "snapDashboard").mockResolvedValue("uploads/snapshots/test.png");
    vi.spyOn(fs, "readFile").mockResolvedValue(Buffer.from("png"));
    const remove = vi.spyOn(fs, "unlink").mockResolvedValue();
    const uploadV2 = vi.fn();
    const check = vi.fn().mockResolvedValueOnce(identity).mockRejectedValueOnce(new Error("Access changed"));
    await expect(withIntegrationContext(context, () => sendDashboardSnapshot({ projectId: 2 },
      { files: { uploadV2 } }, "C1", "original", check))).rejects.toThrow("Access changed");
    expect(uploadV2).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledOnce();
  });
});
