import { afterEach, describe, expect, it, vi } from "vitest";

const { WebClient } = require("@slack/web-api");
const db = require("../../models/models");
const ChartController = require("../../controllers/ChartController");
const snapshots = require("../../modules/snapshots");
const { withIntegrationContext } = require("../../modules/observations/integrationContext");
const { runDeterministicWorkspaceRequest } = require("../../modules/ai/orchestrator/runtime/deterministicExecutor");
const accounts = require("../../apps/slack/accounts");
const ai = require("../../controllers/AiController");
const { channelAllowed, processRequest, resolveRequest } = require("../../apps/slack/conversations");

function record(values) {
  return { ...values, update: vi.fn(async function update(fields) { Object.assign(this, fields); return this; }) };
}

function identity() {
  return {
    account: { id: "account", user_id: 4 }, access: { teamId: 7, userId: 4 },
    integration: { config: { bot_token: "test", allowedChannels: ["C1"] } },
    envelope: { accessVersion: "v1", historyAccessScope: {} },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("Slack conversation boundaries and recovery", () => {
  it("gives an unlinked channel user the DM command when chart creation needs an account", async () => {
    const result = await withIntegrationContext({ accountLinkInstructions: accounts.LINK_INSTRUCTIONS }, () => (
      runDeterministicWorkspaceRequest({
        access: { role: "projectViewer" },
        question: "Generate a line chart",
        roleBoundaryOnly: true,
      })
    ));
    expect(result.message).toContain("direct message with the Chartbrew app in Slack. Send `/chartbrew link`");
  });

  it("uses the shared persistent request path with the linked person", async () => {
    const request = record({ id: "request", account_id: "account", status: "queued", messages: [],
      input: { workspaceId: "T1", slackUserId: "U1", channelId: "D1", threadTs: "123", question: "Show my metrics" } });
    vi.spyOn(db.SlackRequest, "findByPk").mockResolvedValue(request);
    vi.spyOn(db.SlackThread, "findOne").mockResolvedValue(record({ id: "thread", conversation_id: "conversation", channel_id: "D1", dm_channel: "D1", dm_thread_ts: "123" }));
    vi.spyOn(db.AiConversation, "findByPk").mockResolvedValue({ message_count: 1 });
    vi.spyOn(accounts, "resolveAccount").mockResolvedValue(identity());
    const respond = vi.spyOn(ai, "respond").mockImplementation(async () => {
      const { getIntegrationContext } = require("../../modules/observations/integrationContext");
      await getIntegrationContext().toolProgressCallback("read_chart_results", "start", {}, "Read saved chart results");
      return { message: "Your metrics", chartPreviews: [], usage: { totalTokens: 49691 } };
    });
    const api = vi.spyOn(WebClient.prototype, "apiCall").mockResolvedValue({ ts: "124" });
    await processRequest("request");
    expect(respond).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 7, userId: 4, aiConversationId: "conversation", persistence: "persistent", message: "Show my metrics",
    }));
    expect(api.mock.calls.filter(([method]) => method === "chat.update").map(([, payload]) => payload.text))
      .toEqual(["📊 Read saved chart results…", "Your metrics"]);
    const reply = api.mock.calls.filter(([method]) => method === "chat.update").at(-1)[1];
    expect(reply.blocks).toEqual([{ type: "markdown", text: "Your metrics" }]);
    expect(request.status).toBe("complete");
  });

  it("replaces the waiting message with billing instructions when the team runs out of credits", async () => {
    const request = record({ id: "request", account_id: "account", status: "queued", messages: [],
      input: { workspaceId: "T1", slackUserId: "U1", channelId: "C1", threadTs: "123", question: "Show my metrics" } });
    vi.spyOn(db.SlackRequest, "findByPk").mockResolvedValue(request);
    vi.spyOn(db.SlackThread, "findOne").mockResolvedValue(record({ id: "thread", conversation_id: "conversation", channel_id: "C1", dm_channel: "C1", dm_thread_ts: "123" }));
    vi.spyOn(db.AiConversation, "findByPk").mockResolvedValue({ message_count: 1 });
    vi.spyOn(accounts, "resolveAccount").mockResolvedValue(identity());
    const denied = Object.assign(new Error("Your team has no AI credits remaining."), { statusCode: 402 });
    const respond = vi.spyOn(ai, "respond").mockRejectedValue(denied);
    const api = vi.spyOn(WebClient.prototype, "apiCall").mockResolvedValue({ ts: "waiting" });

    await processRequest("request");
    await processRequest("request");

    expect(api).toHaveBeenCalledWith("chat.update", expect.objectContaining({
      channel: "C1", ts: "waiting", text: "Your team has no AI credits remaining. Ask a team owner to check billing in Chartbrew.",
    }));
    expect(respond).toHaveBeenCalledOnce();
    expect(request.status).toBe("complete");
  });

  it.each(["C1", "D1"])("replies in the original %s thread, including old redirected threads", async (channelId) => {
    const request = record({ id: "request", account_id: "account", status: "queued", messages: [],
      input: { workspaceId: "T1", slackUserId: "U1", channelId, threadTs: "original", question: "Show my metrics" } });
    const thread = record({ id: "thread", conversation_id: "conversation", channel_id: channelId,
      thread_ts: "original", dm_channel: "D-old", dm_thread_ts: "old" });
    vi.spyOn(db.SlackRequest, "findByPk").mockResolvedValue(request);
    vi.spyOn(db.SlackThread, "findOne").mockResolvedValue(thread);
    vi.spyOn(db.AiConversation, "findByPk").mockResolvedValue({ message_count: 1 });
    vi.spyOn(accounts, "resolveAccount").mockResolvedValue(identity());
    vi.spyOn(ai, "respond").mockResolvedValue({ message: "Your metrics", chartPreviews: [] });
    const api = vi.spyOn(WebClient.prototype, "apiCall").mockResolvedValue({ ts: "reply" });
    await processRequest("request");
    expect(api).toHaveBeenCalledWith("chat.postMessage", expect.objectContaining({
      channel: channelId, thread_ts: "original", text: "Checking your request…",
    }));
    expect(api).toHaveBeenCalledWith("chat.update", expect.objectContaining({
      channel: channelId, ts: "reply", text: "Your metrics",
    }));
    expect(api.mock.calls.some(([method]) => method === "conversations.open")).toBe(false);
    expect(request.status).toBe("complete");
  });

  it("delivers the written answer before rendering a chart and keeps it when rendering fails", async () => {
    const chart = { id: 1, name: "Revenue", project_id: 2, type: "kpi", render: { updatedAt: "2026-11-12T04:25:28.000Z" } };
    const request = record({ id: "request", account_id: "account", thread_id: "thread", status: "delivering",
      access_version: "v1", progress_ts: "progress", messages: [],
      result: { message: "The complete written answer", cards: [{ chart, parsed: { visibility: "dashboard" }, preparedData: { results: [] } }] },
      input: { workspaceId: "T1", slackUserId: "U1", channelId: "C1" } });
    vi.spyOn(db.SlackRequest, "findByPk").mockResolvedValue(request);
    vi.spyOn(db.SlackThread, "findOne").mockResolvedValue(record({ id: "thread", channel_id: "C1", dm_channel: "C1", dm_thread_ts: "original" }));
    vi.spyOn(accounts, "resolveAccount").mockResolvedValue({ ...identity(), access: { ...identity().access, allProjects: false, projectIds: [2], role: "projectViewer" } });
    vi.spyOn(db.Chart, "findByPk").mockResolvedValue({ ...chart, Project: { team_id: 7, ghost: false }, ChartDatasetConfigs: [] });
    vi.spyOn(db.Chart, "unscoped").mockReturnValue({ findOne: vi.fn().mockResolvedValue(null) });
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({ timezone: "UTC" });
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role: "teamOwner" });
    vi.spyOn(db.Project, "findOne").mockResolvedValue({ id: 2, team_id: 7 });
    vi.spyOn(db.Chart, "findOne").mockResolvedValue(chart);
    vi.spyOn(ChartController.prototype, "findById").mockResolvedValue(chart);
    const api = vi.spyOn(WebClient.prototype, "apiCall").mockResolvedValue({ ts: "reply" });
    Object.defineProperty(request.result.cards[0].parsed, "visibility", { get: () => {
      expect(api).toHaveBeenCalledWith("chat.update", expect.objectContaining({ text: "The complete written answer" }));
      return "dashboard";
    } });
    const render = vi.spyOn(snapshots, "snapChartPreview").mockImplementation(async () => {
      expect(api).toHaveBeenCalledWith("chat.update", expect.objectContaining({ text: "The complete written answer", channel: "C1", ts: "progress" }));
      throw new Error("Render failed");
    });
    await processRequest("request");
    expect(render).toHaveBeenCalledOnce();
    expect(request.status).toBe("complete");
    expect(request.messages).toHaveLength(2);
  });

  it("uses one integration-owned conversation for two people in the same thread", async () => {
    const requests = ["U1", "U2"].map((user, index) => record({
      id: `request-${index}`, account_id: user, integration_id: "integration", team_id: 7, status: "queued", messages: [],
      input: { workspaceId: "T1", slackUserId: user, channelId: "C1", threadTs: "original", question: "Show metrics" },
    }));
    vi.spyOn(db.SlackRequest, "findByPk").mockImplementation(async (id) => requests.find((request) => request.id === id));
    vi.spyOn(accounts, "resolveAccount").mockImplementation(async (_, user) => ({
      ...identity(), account: { id: user, user_id: user === "U1" ? 4 : 5 },
      integration: { ...identity().integration, id: "integration" },
    }));
    let thread = null;
    const find = vi.spyOn(db.SlackThread, "findOne").mockImplementation(async () => thread);
    vi.spyOn(db.SlackThread, "create").mockImplementation(async (fields) => {
      thread = record({ ...fields, id: "thread" });
      return thread;
    });
    const create = vi.spyOn(db.AiConversation, "create").mockResolvedValue({ id: "conversation" });
    vi.spyOn(db.AiConversation, "findByPk").mockResolvedValue({ message_count: 1 });
    const respond = vi.spyOn(ai, "respond").mockResolvedValue({ message: "Your metrics", chartPreviews: [] });
    vi.spyOn(WebClient.prototype, "apiCall").mockResolvedValue({ ts: "reply" });
    await processRequest("request-0");
    await processRequest("request-1");
    expect(create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ user_id: null, integration_id: "integration", source: "slack" }));
    expect(find.mock.calls[0][0].where).toEqual(find.mock.calls[1][0].where);
    expect(find.mock.calls[0][0].where).not.toHaveProperty("account_id");
    expect(respond.mock.calls.map(([input]) => [input.aiConversationId, input.userId])).toEqual([["conversation", 4], ["conversation", 5]]);
  });

  it("sends only the summary when dashboard reads return many chart references", async () => {
    const request = record({ id: "request", account_id: "account", status: "queued", messages: [],
      input: { workspaceId: "T1", slackUserId: "U1", channelId: "C1", threadTs: "original", question: "Give me a dashboard overview" } });
    vi.spyOn(db.SlackRequest, "findByPk").mockResolvedValue(request);
    vi.spyOn(db.SlackThread, "findOne").mockResolvedValue(record({ id: "thread", conversation_id: "conversation", channel_id: "C1" }));
    vi.spyOn(db.AiConversation, "findByPk").mockResolvedValue({ message_count: 1 });
    vi.spyOn(accounts, "resolveAccount").mockResolvedValue(identity());
    vi.spyOn(ai, "respond").mockResolvedValue({ message: "Your dashboard summary", chartPreviews:
      Array.from({ length: 10 }, (_, index) => ({ chartId: index + 1, toolName: "read_chart_results" })),
    });
    const load = vi.spyOn(db.Chart, "findByPk");
    const api = vi.spyOn(WebClient.prototype, "apiCall").mockResolvedValue({ ts: "reply" });
    await processRequest("request");
    expect(load).not.toHaveBeenCalled();
    expect(request.result.cards).toEqual([]);
    expect(api.mock.calls.filter(([method]) => method === "chat.postMessage")).toHaveLength(1);
    expect(api).toHaveBeenCalledWith("chat.update", expect.objectContaining({ text: "Your dashboard summary", ts: "reply" }));
    expect(request.status).toBe("complete");
  });

  it("resolves a follow-up screenshot and delivers one image in the shared thread", async () => {
    const { requestDashboardSnapshot } = require("../../apps/slack/dashboardSnapshot");
    const fs = require("node:fs/promises");
    const current = { ...identity(), access: { ...identity().access, projectIds: [2], allProjects: false },
      integration: { ...identity().integration, id: "integration" } };
    const request = record({ id: "request", account_id: "account", status: "queued", messages: [],
      input: { workspaceId: "T1", slackUserId: "U1", channelId: "C1", threadTs: "original", question: "Screenshot my dashboard and send it here" } });
    vi.spyOn(db.SlackRequest, "findByPk").mockResolvedValue(request);
    const history = vi.spyOn(db.SlackRequest, "findAll").mockResolvedValue([{ result: { dashboardReferences: [2] } }]);
    vi.spyOn(db.SlackThread, "findOne").mockResolvedValue(record({ id: "thread", conversation_id: "conversation", channel_id: "C1" }));
    vi.spyOn(db.AiConversation, "findByPk").mockResolvedValue({ message_count: 2 });
    vi.spyOn(accounts, "resolveAccount").mockResolvedValue(current);
    vi.spyOn(db.Project, "findOne").mockResolvedValue({ id: 2, name: "Product metrics" });
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role: "teamOwner" });
    vi.spyOn(db.Chart, "findAll").mockResolvedValue([]);
    vi.spyOn(ai, "respond").mockImplementation(async () => ({ message: "Here is the saved dashboard view.",
      dashboardSnapshots: [await requestDashboardSnapshot({})],
    }));
    vi.spyOn(snapshots, "snapDashboard").mockResolvedValue("uploads/snapshots/test.png");
    vi.spyOn(fs, "readFile").mockResolvedValue(Buffer.from("png"));
    vi.spyOn(fs, "unlink").mockResolvedValue();
    const api = vi.spyOn(WebClient.prototype, "apiCall").mockImplementation(async (method) => {
      if (method === "files.getUploadURLExternal") return { upload_url: "https://example.com", file_id: "F1" };
      if (method === "files.completeUploadExternal") return { files: [{ id: "F1" }] };
      return { ts: "reply" };
    });
    vi.spyOn(WebClient.prototype, "makeRequest").mockResolvedValue({ status: 200, data: "ok", headers: {} });
    await processRequest("request");
    expect(history).toHaveBeenCalledWith(expect.objectContaining({ where: {
      thread_id: "thread", integration_id: "integration", status: "complete", access_version: "v1",
    } }));
    expect(api).toHaveBeenCalledWith("files.completeUploadExternal", expect.objectContaining({ channel_id: "C1", thread_ts: "original" }));
    expect(request.messages).toEqual([{ channel: "C1", ts: "reply" }, { channel: "C1", fileId: "F1" }]);
    expect(request.result.dashboardReferences).toEqual([2]);
    expect(request.status).toBe("complete");
  });

  it.each([false, true])("sends the requested chart without sending summary references (refresh: %s)", async (refresh) => {
    const chart = { id: 1, project_id: 2, name: "Token usage", type: "line",
      visualization: { layers: [{ mark: "line" }] },
      render: { tabularData: { Tokens: [{ Category: "Monday", Tokens: 10 }] } },
    };
    const request = record({ id: "request", account_id: "account", status: "queued", messages: [],
      input: { workspaceId: "T1", slackUserId: "U1", channelId: "C1", threadTs: "original", question: "Show token usage" } });
    vi.spyOn(db.SlackRequest, "findByPk").mockResolvedValue(request);
    vi.spyOn(db.SlackThread, "findOne").mockResolvedValue(record({ id: "thread", conversation_id: "conversation", channel_id: "C1" }));
    vi.spyOn(db.AiConversation, "findByPk").mockResolvedValue({ message_count: 1 });
    vi.spyOn(accounts, "resolveAccount").mockResolvedValue({ ...identity(),
      access: { ...identity().access, projectIds: [2], canConfigureTeam: true },
      envelope: { ...identity().envelope, editableProjectIds: [2] },
    });
    vi.spyOn(db.Chart, "findByPk").mockResolvedValue({ ...chart, Project: { team_id: 7, ghost: false }, ChartDatasetConfigs: [] });
    vi.spyOn(db.Chart, "unscoped").mockReturnValue({ findOne: vi.fn().mockResolvedValue(null) });
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({ timezone: "UTC" });
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role: "teamOwner" });
    vi.spyOn(db.Project, "findOne").mockResolvedValue({ id: 2, team_id: 7 });
    vi.spyOn(db.Chart, "findOne").mockResolvedValue(chart);
    vi.spyOn(ChartController.prototype, "findById").mockResolvedValue(chart);
    const update = vi.spyOn(ChartController.prototype, "updateChartData").mockResolvedValue(chart);
    vi.spyOn(ai, "respond").mockResolvedValue({ message: "Here is token usage.", chartPreviews: [
      { chartId: 99, toolName: "read_chart_results" },
      { chartId: 1, toolName: "request_chart_preview", refreshRequested: refresh },
    ] });
    vi.spyOn(snapshots, "snapChartPreview").mockResolvedValue(Buffer.from("png"));
    const api = vi.spyOn(WebClient.prototype, "apiCall").mockImplementation(async (method) => {
      if (method === "files.getUploadURLExternal") return { upload_url: "https://example.com", file_id: "F1" };
      if (method === "files.completeUploadExternal") return { files: [{ id: "F1" }] };
      return { ts: "reply" };
    });
    vi.spyOn(WebClient.prototype, "makeRequest").mockResolvedValue({ status: 200, data: "ok", headers: {} });
    await processRequest("request");
    expect(update).toHaveBeenCalledTimes(refresh ? 1 : 0);
    expect(request.result.cards).toHaveLength(1);
    expect(api).toHaveBeenCalledWith("chat.postMessage", expect.objectContaining({ channel: "C1", thread_ts: "original",
      blocks: expect.arrayContaining([expect.objectContaining({ type: "image", slack_file: { id: "F1" }, alt_text: "Token usage" })]),
    }));
    expect(request.status).toBe("complete");
  });

  it("denies channels unless explicitly allowed", () => {
    expect(channelAllowed({ config: {} }, "C1")).toBeFalsy();
    expect(channelAllowed({ config: { allowedChannels: ["C1"] } }, "C2")).toBeFalsy();
    expect(channelAllowed({ config: { allowedChannels: ["C1"] } }, "C1")).toBe(true);
  });

  it("rejects old queued requests after unlinking and relinking", async () => {
    vi.spyOn(accounts, "resolveAccount").mockResolvedValue(identity());
    await expect(resolveRequest({ account_id: "old-account", input: { workspaceId: "T1", slackUserId: "U1", channelId: "C1" } }))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it("does not repeat completed requests", async () => {
    vi.spyOn(db.SlackRequest, "findByPk").mockResolvedValue({ status: "complete" });
    const respond = vi.spyOn(ai, "respond");
    await processRequest("request");
    expect(respond).not.toHaveBeenCalled();
  });

  it("retries stored delivery without repeating orchestration", async () => {
    const request = record({ id: "request", account_id: "account", thread_id: "thread", status: "delivering",
      access_version: "v1", progress_ts: "123", result: { message: "Saved answer", cards: [] }, messages: [],
      input: { workspaceId: "T1", slackUserId: "U1", channelId: "D1" } });
    vi.spyOn(db.SlackRequest, "findByPk").mockResolvedValue(request);
    vi.spyOn(db.SlackThread, "findOne").mockResolvedValue(record({ id: "thread", channel_id: "C1", dm_channel: "D1", dm_thread_ts: "123" }));
    vi.spyOn(accounts, "resolveAccount").mockResolvedValue(identity());
    const respond = vi.spyOn(ai, "respond");
    const api = vi.spyOn(WebClient.prototype, "apiCall").mockResolvedValue({ ts: "123" });
    await processRequest("request");
    expect(respond).not.toHaveBeenCalled();
    expect(api).toHaveBeenCalledWith("chat.update", expect.objectContaining({ channel: "D1", ts: "123", text: "Saved answer" }));
    expect(request.status).toBe("complete");
  });

  it.each([false, true])("delivers long formatted answers within Slack limits (fallback: %s)", async (rejectMarkdown) => {
    const message = "**Metrics** & results\n\n".repeat(1000);
    const request = record({ id: "request", account_id: "account", thread_id: "thread", status: "delivering",
      access_version: "v1", progress_ts: "progress", result: { message, cards: [] }, messages: [],
      input: { workspaceId: "T1", slackUserId: "U1", channelId: "C1" } });
    vi.spyOn(db.SlackRequest, "findByPk").mockResolvedValue(request);
    vi.spyOn(db.SlackThread, "findOne").mockResolvedValue(record({ id: "thread", channel_id: "C1", dm_channel: "C1", dm_thread_ts: "original" }));
    vi.spyOn(accounts, "resolveAccount").mockResolvedValue(identity());
    const delivered = [];
    vi.spyOn(WebClient.prototype, "apiCall").mockImplementation(async (method, payload) => {
      const markdown = payload.blocks.filter((block) => block.type === "markdown");
      expect(markdown.reduce((sum, block) => sum + block.text.length, 0)).toBeLessThanOrEqual(12000);
      if (rejectMarkdown && markdown.length) throw Object.assign(new Error("Invalid blocks"), { data: { error: "invalid_blocks" } });
      delivered.push(payload);
      return { ts: "reply" };
    });
    await processRequest("request");
    expect(request.status).toBe("complete");
    expect(delivered.map((payload) => payload.text).join("")).toBe(message.trim().replace(/&/g, "&amp;"));
    expect(delivered[0].ts).toBe("progress");
    expect(delivered.slice(1).every((payload) => payload.thread_ts === "original")).toBe(true);
  });

  it("does not deliver stored data after a permission change", async () => {
    const request = record({ id: "request", account_id: "account", thread_id: "thread", status: "delivering",
      access_version: "old", result: { message: "Restricted answer", cards: [] }, messages: [],
      input: { workspaceId: "T1", slackUserId: "U1", channelId: "D1" } });
    vi.spyOn(db.SlackRequest, "findByPk").mockResolvedValue(request);
    vi.spyOn(db.SlackThread, "findOne").mockResolvedValue(record({ id: "thread", channel_id: "C1", dm_channel: "D1", dm_thread_ts: "123" }));
    vi.spyOn(accounts, "resolveAccount").mockResolvedValue(identity());
    vi.spyOn(accounts, "getIntegration").mockResolvedValue(null);
    const api = vi.spyOn(WebClient.prototype, "apiCall");
    await processRequest("request");
    expect(api).not.toHaveBeenCalled();
    expect(request.error).toBeTruthy();
  });

  it("rejects another person's result before running any action", async () => {
    const request = record({ id: "request", account_id: "account", status: "queued",
      input: { workspaceId: "T1", slackUserId: "U1", channelId: "D1", parentId: "parent", action: "slack_confirm", messageTs: "123" } });
    vi.spyOn(db.SlackRequest, "findByPk").mockImplementation(async (id) => id === "parent"
      ? { account_id: "other", status: "complete" } : request);
    vi.spyOn(accounts, "resolveAccount").mockResolvedValue(identity());
    vi.spyOn(accounts, "getIntegration").mockResolvedValue(null);
    const respond = vi.spyOn(ai, "respond");
    await processRequest("request");
    expect(respond).not.toHaveBeenCalled();
    expect(request.error).toBeTruthy();
  });
});
