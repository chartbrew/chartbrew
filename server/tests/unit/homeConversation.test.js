import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { Responses } = require("openai/resources/responses/responses");
const db = require("../../models/models");
const ProjectController = require("../../controllers/ProjectController");
const { setPlatformSettingOverrides } = require("../../modules/platformSettings/runtime");

const user = (content) => ({ role: "user", content });
const answer = (text) => ({ output_text: text, output: [], usage: { input_tokens: 1, output_tokens: 1 } });
let orchestrate;
let createResponse;
let createDashboard;

beforeEach(() => {
  vi.stubEnv("CB_OPENAI_API_KEY_DEV", "test-key");
  setPlatformSettingOverrides({ "workspaceOrchestrator.enabled": true });
  delete require.cache[require.resolve("../../modules/ai/orchestrator/orchestrator")];
  ({ orchestrate } = require("../../modules/ai/orchestrator/orchestrator"));
  createResponse = vi.spyOn(Responses.prototype, "create").mockResolvedValue(answer("Which tool records your sales?"));
  createDashboard = vi.spyOn(ProjectController.prototype, "create").mockResolvedValue({ id: 55, name: "Sales" });
  vi.spyOn(db.Team, "findByPk").mockResolvedValue({ id: 7 });
  vi.spyOn(db.Project, "findAll").mockResolvedValue([{ id: 1, name: "First Dashboard", Charts: [] }]);
  vi.spyOn(db.Connection, "findAll").mockResolvedValue([]);
  vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role: "teamOwner" });
  vi.spyOn(db.Connection, "count").mockResolvedValue(0);
  vi.spyOn(db.Dataset, "count").mockResolvedValue(0);
  vi.spyOn(db.AiMemory, "findAll").mockResolvedValue([]);
  vi.spyOn(db.Connection, "findByPk").mockResolvedValue({ id: 8, team_id: 7, active: true, type: "postgres" });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  setPlatformSettingOverrides({});
  delete require.cache[require.resolve("../../modules/ai/orchestrator/orchestrator")];
});

const call = (name, args) => ({
  output: [{ type: "function_call", call_id: name, name, arguments: JSON.stringify(args) }],
  usage: { input_tokens: 1, output_tokens: 1 },
});

describe("normal conversation with an empty team", () => {
  it("uses the agent for open help and short follow-ups without a forced form or tool", async () => {
    const first = await orchestrate(7, "How do I get started?", [], null, null, { userId: 3 });
    await orchestrate(7, "Build a dashboard", first.conversationHistory, null, null, { userId: 3 });
    expect(createResponse).toHaveBeenCalledTimes(2);
    for (const [request] of createResponse.mock.calls) {
      expect(request.tool_choice).toBe("auto");
      const tools = request.tools.map((tool) => tool.name);
      expect(tools).toContain("source_plan_dataset");
      expect(tools).toContain("create_temporary_chart");
      expect(tools).not.toContain("prepare_report");
      expect(request.instructions).toContain("Ask at most one blocking question");
      expect(request.instructions).toContain("inspect its data, then continue the original request");
      expect(request.instructions).not.toContain("Sales performance");
    }
    expect(createDashboard).not.toHaveBeenCalled();
  });

  it("blocks premature dashboard creation in the shared tool", async () => {
    createResponse.mockResolvedValueOnce(call("create_dashboard", { name: "New Dashboard" }));
    const result = await orchestrate(7, "Build a dashboard", [user("How do I get started?")], null, null, { userId: 3 });
    expect(createDashboard).not.toHaveBeenCalled();
    expect(result.conversationHistory.find((message) => message.name === "create_dashboard").content)
      .toContain("Connect a data source or prepare a dataset");
    expect(db.Connection.count).toHaveBeenCalledWith({ where: { team_id: 7, active: true } });
    expect(db.Dataset.count).toHaveBeenCalledWith({ where: { team_id: 7, draft: false } });
  });

  it("resolves the named source on a follow-up without a report plan", async () => {
    createResponse.mockResolvedValueOnce(call("list_connections", { provider: "PostHog" }));
    const result = await orchestrate(7, "PostHog, plus customer records in Postgres", [
      user("I want to monitor activity in my product"),
    ], null, null, { userId: 3 });
    const tool = result.conversationHistory.find((message) => message.name === "list_connections");
    expect(JSON.parse(tool.content).options).toEqual([
      expect.objectContaining({ provider_id: "posthog", state: "mcp_oauth_setup" }),
    ]);
    expect(createDashboard).not.toHaveBeenCalled();
  });

  it("does not return a source catalogue when the source is unknown", async () => {
    createResponse.mockResolvedValueOnce(call("list_connections", {}));
    const result = await orchestrate(7, "We run a marketplace for designers", [], null, null, { userId: 3 });
    const tool = result.conversationHistory.find((message) => message.name === "list_connections");
    expect(JSON.parse(tool.content)).toMatchObject({ connections: [], options: [], setup_url: "/connections/new" });
    expect(createDashboard).not.toHaveBeenCalled();
  });

  it("finds a newly saved connection in the same chat before it has a dataset", async () => {
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({ id: 1, team_id: 7 });
    vi.spyOn(db.Dataset, "findAll").mockResolvedValue([]);
    const lookup = () => call("list_connections", { project_id: "1", provider: "MySQL" });
    createResponse.mockResolvedValueOnce(lookup());
    const first = await orchestrate(7, "Build a sales report with MySQL", [], null, null, { userId: 3 });
    expect(JSON.parse(first.conversationHistory.find((message) => message.name === "list_connections").content).connections)
      .toEqual([]);

    db.Connection.findAll.mockImplementation(async ({ where }) => (where.id ? [] : [{
      id: 8, team_id: 7, type: "mysql", name: "Sales database", active: true,
    }]));
    createResponse.mockResolvedValueOnce(lookup());
    const next = await orchestrate(7, "I added the connection for MySQL. Check connections again and continue my original request.",
      first.conversationHistory, null, null, { userId: 3 });
    const result = JSON.parse(next.conversationHistory.findLast((message) => message.name === "list_connections").content);
    expect(result.connections).toEqual([expect.objectContaining({ id: 8, name: "Sales database" })]);
    expect(result.options).toEqual([expect.objectContaining({ state: "connected", connection_id: 8 })]);
    expect(db.Dataset.findAll).not.toHaveBeenCalled();
  });

  it("preserves actual ambiguity choices instead of substituting business categories", async () => {
    createResponse.mockResolvedValueOnce(call("disambiguate", {
      prompt: "Which event represents a new customer?",
      options: ["user_signed_up", "account_created"].map((label) => ({ label, value: label })),
    }));
    const result = await orchestrate(7, "Show customer signups", [], null, null, { userId: 3 });
    expect(result.message).toContain("user_signed_up");
    expect(result.message).toContain("account_created");
    expect(result.message).not.toContain("Sales performance");
    expect(createDashboard).not.toHaveBeenCalled();
  });
});
