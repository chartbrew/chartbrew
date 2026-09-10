import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = require("../../models/models");
const listConnections = require("../../modules/ai/orchestrator/tools/listConnections");
const { getSourceById } = require("../../sources");
const providers = require("../../sources/plugins/mcp/mcp.providers");

const request = (payload = {}) => listConnections({ team_id: 7, user_id: 3, ...payload });

describe("connection setup resolution", () => {
  beforeEach(() => {
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role: "teamOwner" });
    vi.spyOn(db.Connection, "findAll").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("prefers an existing connection and returns no secrets or schemas", async () => {
    db.Connection.findAll.mockResolvedValue([{
      id: 8, type: "postgres", name: "Reports", active: true,
      host: "private-host", schema: { secret: "hidden" }, password: "hidden",
    }]);
    const result = await request({ provider: "PostgreSQL", capability: "query" });
    expect(result.options).toEqual([{
      state: "connected", connection_id: 8, source_id: "postgres", name: "Reports",
    }]);
    expect(JSON.stringify(result)).not.toMatch(/private-host|hidden|password|schema/);
    expect(db.TeamRole.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { team_id: 7, user_id: 3 },
    }));
  });

  it("offers installed native setup before MCP setup", async () => {
    expect((await request({ provider: "Google Analytics", capability: "query" })).options).toEqual([{
      state: "native_setup", source_id: "googleAnalytics", name: "Google Analytics",
      setup_url: "/connections/new?type=googleAnalytics",
    }]);
  });

  it("offers OAuth only for a documented provider and supported capability", async () => {
    expect((await request({ provider: "posthog", capability: "query" })).options).toEqual([
      expect.objectContaining({
        state: "mcp_oauth_setup", provider_id: "posthog",
        server_url: "https://mcp.posthog.com/mcp?mode=tools&readonly=true",
      }),
    ]);
    expect((await request({ provider: "Unknown provider" })).options).toEqual([
      expect.objectContaining({ state: "manual_mcp_setup" }),
    ]);
    expect((await request({ provider: "PostHog", capability: "schema" })).options[0].state)
      .toBe("manual_mcp_setup");
    providers.forEach((provider) => {
      expect(new URL(provider.url).protocol).toBe("https:");
      expect(new URL(provider.documentationUrl).protocol).toBe("https:");
      expect(provider.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it("finds an existing MCP provider by endpoint without exposing its URL", async () => {
    db.Connection.findAll.mockResolvedValue([{
      id: 9, type: "mcp", subType: "mcp", name: "Site analytics", active: true,
      host: "https://mcp.posthog.com/mcp?project_id=private-project",
    }]);
    vi.spyOn(getSourceById("mcp").backend.ai, "getCapabilities").mockReturnValue({ approvedToolCount: 1 });
    const result = await request({ provider: "PostHog" });
    expect(result.options[0]).toMatchObject({ state: "connected", connection_id: 9 });
    expect(JSON.stringify(result)).not.toContain("private-project");
  });

  it("does not mark inactive or unapproved connections as ready", async () => {
    db.Connection.findAll.mockResolvedValue([{
      id: 9, type: "mcp", name: "PostHog", active: true,
      schema: { mcp: { tools: [], allowedTools: {} } },
    }]);
    expect(await request({ provider: "PostHog" })).toMatchObject({
      connections: [], options: [{ state: "admin_required", connection_id: 9 }],
    });
    db.Connection.findAll.mockResolvedValue([{
      id: 9, type: "mcp", name: "PostHog", active: false,
    }]);
    expect(await request({ provider: "PostHog" })).toMatchObject({
      connections: [], options: [{ state: "native_setup", setup_url: "/connections/9" }],
    });
  });

  it("returns an admin request without reading connections for other roles", async () => {
    await expect(request({ user_id: undefined })).rejects.toThrow("Access denied");
    db.TeamRole.findOne.mockResolvedValue({ role: "projectEditor", projects: [12] });
    expect(await request({ provider: "PostHog" })).toEqual({
      connections: [], options: [{ state: "admin_required", name: "PostHog" }],
    });
    expect(db.Connection.findAll).not.toHaveBeenCalled();
    db.TeamRole.findOne.mockResolvedValue(null);
    await expect(request()).rejects.toThrow("Access denied");
  });

  it("preserves dashboard scope and rejects a dashboard from another team", async () => {
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({ id: 12, team_id: 7 });
    vi.spyOn(db.Dataset, "findAll").mockResolvedValue([
      { connection_id: 8, project_ids: [12], DataRequests: [{ connection_id: 9 }] },
      { connection_id: 10, project_ids: [13] },
    ]);
    await request({ project_id: 12 });
    expect(db.Connection.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ team_id: 7, id: [8, 9] }),
    }));
    db.Project.findByPk.mockResolvedValue({ id: 12, team_id: 99 });
    await expect(request({ project_id: 12 })).rejects.toThrow("Project does not belong");
  });

  it("does not offer disabled sources", async () => {
    vi.stubEnv("CB_DISABLED_SERVER_SOURCES", "mcp,googleAnalytics");
    expect((await request({ provider: "PostHog" })).options[0].state).toBe("unsupported");
    expect((await request({ provider: "Google Analytics" })).options[0].state).toBe("unsupported");
  });

  it("caps output and rejects invalid input before reading connections", async () => {
    await expect(request({ provider: { name: "PostHog" } })).rejects.toThrow("Specify a provider");
    await expect(request({ capability: "approve_tools" })).rejects.toThrow("Specify a provider");
    expect(db.Connection.findAll).not.toHaveBeenCalled();
    db.Connection.findAll.mockResolvedValue(Array.from({ length: 12 }, (_, id) => ({
      id, type: "postgres", name: `DB ${id}`, active: true,
    })));
    const result = await request();
    expect(result.connections).toHaveLength(5);
    expect(result.options).toHaveLength(5);
    expect(result.has_more).toBe(true);
  });
});
