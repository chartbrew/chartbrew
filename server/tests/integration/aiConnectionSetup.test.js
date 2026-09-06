import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createTestApp } from "../helpers/testApp.js";
import { testDbManager } from "../helpers/testDbManager.js";
import { getModels } from "../helpers/dbHelpers.js";
import { generateTestToken } from "../helpers/authHelpers.js";
import { teamFactory } from "../factories/teamFactory.js";
import { userFactory } from "../factories/userFactory.js";

const { getWorkspaceAccessEnvelope } = require("../../modules/workspaceContext/accessEnvelope");
const { getObservationAccess } = require("../../modules/observations/access");
const { getSourceById } = require("../../sources");
const jwt = require("jsonwebtoken");
const settings = require("../../settings-dev");
const aiRoute = require("../../api/AiRoute");
const connectionRoute = require("../../api/ConnectionRoute");
const { sanitizeTool } = require("../../sources/plugins/mcp/mcp.policy");

describe("connection cards", () => {
  let models;
  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    models = await getModels();
  });
  afterEach(() => vi.restoreAllMocks());

  async function seed(role = "teamOwner") {
    const user = await models.User.create(userFactory.build());
    const team = await models.Team.create(teamFactory.build());
    await models.TeamRole.create({ team_id: team.id, user_id: user.id, role });
    const conversation = await models.AiConversation.create({ team_id: team.id, user_id: user.id, title: "Connect PostHog" });
    const envelope = await getWorkspaceAccessEnvelope(await getObservationAccess(team.id, user.id));
    await models.AiMessage.create({ conversation_id: conversation.id, role: "user", sequence: 0, content: "Show visitor countries" });
    const message = await models.AiMessage.create({
      conversation_id: conversation.id, role: "tool", tool_name: "list_connections", sequence: 1,
      sensitive_workspace_context: true, workspace_access_version: envelope.accessVersion,
      content: JSON.stringify({ options: [{ provider_id: "posthog", state: "mcp_oauth_setup", name: "PostHog", source_id: "mcp" }] }),
    });
    return {
      user, team, conversation, message,
      token: generateTestToken({ id: user.id, email: user.email, name: user.name }),
      payload: { teamId: team.id, conversationId: conversation.id, providerId: "posthog" },
    };
  }

  it("creates only on click, reuses the connection, and persists its reference", async () => {
    const { token, payload, message, team } = await seed();
    const app = await createTestApp();
    aiRoute(app);
    const before = await request(app).get("/ai/connections/setup").query(payload).auth(token, { type: "bearer" });
    expect(before.status).toBe(200);
    expect(before.body.state).toBe("mcp_oauth_setup");
    expect(await models.Connection.count({ where: { team_id: team.id } })).toBe(0);
    const [first, retry] = await Promise.all([1, 2].map(() => request(app)
      .post("/ai/connections/setup").auth(token, { type: "bearer" }).send({
        ...payload, host: "https://unverified.example/mcp", allowedTools: { dangerous: { ask: true } },
      })));
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(retry.body.connection_id).toBe(first.body.connection_id);
    const connection = await models.Connection.findByPk(first.body.connection_id);
    expect(connection.active).toBe(false);
    expect(connection.authentication.type).toBe("oauth");
    expect(connection.host).toBe("https://mcp.posthog.com/mcp?mode=tools&readonly=true");
    expect(connection.options.mcp.toolQuery).toBe("Show visitor countries");
    expect(connection.schema.mcp.allowedTools).toBeUndefined();
    expect(await models.Connection.count({ where: { team_id: team.id } })).toBe(1);
    await message.reload();
    expect(JSON.parse(message.content).options[0].connection_id).toBe(connection.id);
    await connection.update({ active: true });
    const after = await request(app).get("/ai/connections/setup").query(payload).auth(token, { type: "bearer" });
    expect(after.body).toMatchObject({ state: "connected", needs_approval: true, connection_id: connection.id });
    await connection.update({ host: "https://changed.example/mcp" });
    const changed = await request(app).post("/ai/connections/setup").auth(token, { type: "bearer" }).send(payload);
    expect(changed.status).toBe(409);
    expect(await models.Connection.count({ where: { team_id: team.id } })).toBe(1);
  });

  it("rejects other users, roles, providers, and stale setup offers", async () => {
    const { token, payload, message, team } = await seed();
    const app = await createTestApp();
    aiRoute(app);
    expect((await request(app).post("/ai/connections/setup").send(payload)).status).toBe(401);
    expect((await request(app).post("/ai/connections/setup").auth(token, { type: "bearer" })
      .send({ ...payload, providerId: "https://evil.example/mcp" })).status).toBe(400);
    const otherUser = await models.User.create(userFactory.build());
    await models.TeamRole.create({ team_id: team.id, user_id: otherUser.id, role: "teamAdmin" });
    const otherToken = generateTestToken({ id: otherUser.id, email: otherUser.email });
    expect((await request(app).post("/ai/connections/setup").auth(otherToken, { type: "bearer" }).send(payload)).status).toBe(404);
    await message.update({ workspace_access_version: "stale" });
    expect((await request(app).post("/ai/connections/setup").auth(token, { type: "bearer" }).send(payload)).status).toBe(409);
    const editor = await seed("projectEditor");
    expect((await request(app).post("/ai/connections/setup").auth(editor.token, { type: "bearer" }).send(editor.payload)).status).toBe(403);
    expect(await models.Connection.count()).toBe(0);
  });

  it("preserves concurrent tool approvals and changes both permissions together", async () => {
    const { team, user } = await seed();
    const tools = Array.from({ length: 8 }, (_, id) => sanitizeTool({
      name: `query_${id}`, inputSchema: { type: "object" }, annotations: { readOnlyHint: true },
    }));
    const connection = await models.Connection.create({
      name: "Approval test", team_id: team.id, type: "mcp", subType: "mcp",
      host: "https://fixture.example/mcp", schema: { mcp: { tools, allowedTools: {} } },
    });
    const update = (toolName, enabled) => getSourceById("mcp").backend.actions.updateToolApproval({
      connection, user: { id: user.id, isEditor: true }, params: { toolName, enabled },
    });
    await Promise.all(tools.map((tool) => update(tool.name, true)));
    await connection.reload();
    tools.forEach((tool) => expect(connection.schema.mcp.allowedTools[tool.name]).toMatchObject({ ask: true, datasets: true }));
    await Promise.all([update(tools[0].name, false), update(tools[1].name, false)]);
    await connection.reload();
    tools.forEach((tool, index) => expect(connection.schema.mcp.allowedTools[tool.name])
      .toMatchObject({ ask: index >= 2, datasets: index >= 2 }));
    expect(connection.schema.mcp.tools).toHaveLength(8);
    await expect(update(tools[0].name, "true")).rejects.toMatchObject({ code: "MCP_INVALID_APPROVAL" });
    await expect(update("missing_tool", true)).rejects.toMatchObject({ code: "MCP_TOOL_NOT_FOUND" });
  });

  it("saves bulk approvals together and rejects invalid or destructive tools without partial changes", async () => {
    const { team, user } = await seed();
    const tools = Array.from({ length: 23 }, (_, id) => sanitizeTool({
      name: `read_${id}`, inputSchema: { type: "object" }, annotations: { readOnlyHint: true },
    }));
    tools.push(sanitizeTool({ name: "delete_data", annotations: { destructiveHint: true } }));
    const connection = await models.Connection.create({
      name: "Bulk approval test", team_id: team.id, type: "mcp", subType: "mcp",
      host: "https://fixture.example/mcp", schema: { mcp: { tools, allowedTools: {} } },
    });
    const update = (toolNames, isEditor = true) => getSourceById("mcp").backend.actions.updateToolApproval({
      connection, user: { id: user.id, isEditor }, params: { toolNames, enabled: true },
    });
    await expect(update(["read_0"], false)).rejects.toMatchObject({ code: "MCP_ADMIN_REQUIRED" });
    for (const names of [[], [1], [""], "read_0", Array(251).fill("read_0")]) {
      await expect(update(names)).rejects.toMatchObject({ code: "MCP_INVALID_APPROVAL" });
    }
    await expect(update(["read_0", "delete_data"])).rejects.toMatchObject({ code: "MCP_TOOL_NOT_AVAILABLE" });
    await expect(update(["read_0", "missing"])).rejects.toMatchObject({ code: "MCP_TOOL_NOT_FOUND" });
    await connection.reload();
    expect(connection.schema.mcp.allowedTools).toEqual({});
    const result = await update(tools.slice(0, 23).map((tool) => tool.name));
    await connection.reload();
    expect(connection.schema.mcp.allowedTools).toEqual(result.allowedTools);
    expect(Object.keys(result.allowedTools)).toHaveLength(23);
    tools.slice(0, 23).forEach((tool) => expect(result.allowedTools[tool.name]).toMatchObject({
      ask: true, datasets: true, approvedBy: user.id, contractFingerprint: tool.contractFingerprint,
    }));
    expect(result.allowedTools.delete_data).toBeUndefined();
  });

  it("rolls back the connection if its conversation reference cannot be saved", async () => {
    const { token, payload, team } = await seed();
    const app = await createTestApp();
    aiRoute(app);
    vi.spyOn(models.AiMessage.prototype, "update").mockRejectedValueOnce(new Error("Write failed"));
    const result = await request(app).post("/ai/connections/setup").auth(token, { type: "bearer" }).send(payload);
    expect(result.status).toBe(500);
    expect(await models.Connection.count({ where: { team_id: team.id } })).toBe(0);
  });

  it("returns OAuth success and failure to the connection with the signed conversation reference", async () => {
    const { token, payload, team, conversation } = await seed();
    const app = await createTestApp();
    aiRoute(app);
    connectionRoute(app);
    const prepared = await request(app).post("/ai/connections/setup").auth(token, { type: "bearer" }).send(payload);
    expect(prepared.status).toBe(200);
    const connectionId = prepared.body.connection_id;
    const state = jwt.sign({ connectionId, teamId: team.id, conversationId: conversation.id }, settings.secret,
      { audience: "mcp-chat-return", expiresIn: "30m" });
    await models.Connection.update({ authentication: { type: "oauth", state } }, { where: { id: connectionId } });
    const finish = vi.spyOn(getSourceById("mcp").backend, "completeOAuth").mockResolvedValue({});
    const callback = `/team/${team.id}/connections/${connectionId}/mcp/oauth/callback`;
    const success = await request(app).get(callback).query({ code: "test-code", state });
    expect(success.status).toBe(302);
    expect(new URL(success.headers.location).pathname).toBe(`/connections/${connectionId}`);
    expect(success.headers.location).toContain(`aiConversationId=${conversation.id}`);
    expect(success.headers.location).toContain("mcpOAuth=success");
    finish.mockRejectedValue(new Error("Denied"));
    const failure = await request(app).get(callback).query({ state, error: "access_denied" });
    expect(new URL(failure.headers.location).pathname).toBe(`/connections/${connectionId}`);
    expect(failure.headers.location).toContain(`aiConversationId=${conversation.id}`);
    expect(failure.headers.location).toContain("mcpOAuth=error");
    expect(await models.AiMessage.count({ where: { conversation_id: conversation.id } })).toBe(2);
  });
});
