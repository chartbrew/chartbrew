import {
  beforeAll, describe, expect, it, vi
} from "vitest";

import { testDbManager } from "../helpers/index.js";
import { getModels } from "../helpers/dbHelpers.js";
import { userFactory } from "../factories/userFactory.js";
import { projectFactory } from "../factories/projectFactory.js";
import { teamFactory } from "../factories/teamFactory.js";

const AiController = require("../../controllers/AiController.js");
const socketManager = require("../../modules/socketManager.js");

async function createOwnedConversation(models) {
  const owner = await models.User.create(userFactory.build({
    email: "ai-owner@example.test",
  }));
  const otherUser = await models.User.create(userFactory.build({
    email: "ai-other@example.test",
  }));
  const team = await models.Team.create(teamFactory.build({
    name: "AI Ownership Team",
  }));

  await models.TeamRole.bulkCreate([{
    team_id: team.id,
    user_id: owner.id,
    role: "teamOwner",
  }, {
    team_id: team.id,
    user_id: otherUser.id,
    role: "teamAdmin",
  }]);

  const conversation = await models.AiConversation.create({
    team_id: team.id,
    user_id: owner.id,
    title: "Private AI Conversation",
    status: "active",
  });

  await models.AiMessage.create({
    conversation_id: conversation.id,
    role: "user",
    content: "Summarize private revenue notes",
    sequence: 0,
  });

  return {
    owner,
    otherUser,
    team,
    conversation,
  };
}

describe("AI conversation ownership", () => {
  let models;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) {
      await testDbManager.start();
    }

    models = await getModels();
  });

  it("prevents another team admin from reading a user's AI conversation", async () => {
    const {
      otherUser,
      team,
      conversation,
    } = await createOwnedConversation(models);

    await expect(
      AiController.getConversation(conversation.id, team.id, otherUser.id)
    ).rejects.toThrow("Conversation does not belong to this user");
  });

  it("prevents another team admin from deleting a user's AI conversation", async () => {
    const {
      otherUser,
      team,
      conversation,
    } = await createOwnedConversation(models);

    await expect(
      AiController.deleteConversation(conversation.id, team.id, otherUser.id)
    ).rejects.toThrow("Conversation does not belong to this user");

    await expect(models.AiConversation.findByPk(conversation.id)).resolves.toBeTruthy();
  });

  it("prevents another team admin from resuming a user's AI conversation", async () => {
    const {
      otherUser,
      team,
      conversation,
    } = await createOwnedConversation(models);

    await expect(
      AiController.getOrchestration(
        team.id,
        "Continue this chat",
        [],
        conversation.id,
        otherUser.id,
      )
    ).rejects.toThrow("Conversation does not belong to this user");
  });

  it("authorizes socket conversation rooms by conversation owner", async () => {
    const {
      owner,
      otherUser,
      conversation,
    } = await createOwnedConversation(models);

    await expect(
      socketManager.canJoinConversation(owner.id, conversation.id)
    ).resolves.toBe(true);

    await expect(
      socketManager.canJoinConversation(otherUser.id, conversation.id)
    ).resolves.toBe(false);
  });

  it("allows joining ephemeral Ask session rooms with a team", async () => {
    const { owner, team } = await createOwnedConversation(models);
    const sessionId = "11111111-1111-4111-8111-111111111111";

    await expect(
      socketManager.canJoinConversation(owner.id, sessionId, team.id)
    ).resolves.toBe(true);

    await expect(
      socketManager.canJoinConversation(owner.id, sessionId)
    ).resolves.toBe(false);
  });

  it("identifies a new saved conversation with its team and originating chat request", async () => {
    const { owner, team } = await createOwnedConversation(models);
    await models.TeamRole.update({ role: "projectViewer" }, { where: { user_id: owner.id, team_id: team.id } });
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const emit = vi.spyOn(socketManager, "emitToUser");
    try {
      const result = await AiController.respond({
        teamId: team.id, userId: owner.id, sessionId,
        message: "Create a dashboard",
      });
      expect(emit).toHaveBeenCalledWith(owner.id, "conversation-created", {
        conversationId: result.aiConversationId, teamId: team.id, sessionId,
      });
      const saved = await AiController.getConversation(result.aiConversationId, team.id, owner.id);
      expect(saved.title).toBe("Create a dashboard");
      expect(saved.full_history.filter((message) => message.role === "user")).toEqual([
        { role: "user", content: "Create a dashboard" },
      ]);
      await AiController.respond({
        teamId: team.id, userId: owner.id, aiConversationId: result.aiConversationId,
        message: "Create a chart",
      });
      const continued = await AiController.getConversation(result.aiConversationId, team.id, owner.id);
      expect(continued.title).toBe(saved.title);
      expect(continued.full_history.filter((message) => message.role === "user")).toHaveLength(2);
    } finally {
      emit.mockRestore();
    }
  });

  it("shows a useful name for old generic titles in the list and the open chat", async () => {
    const { owner, team, conversation } = await createOwnedConversation(models);
    await conversation.update({ title: "Saved conversation" });
    expect((await AiController.getConversation(conversation.id, team.id, owner.id)).title)
      .toBe("Summarize private revenue notes");
    expect((await AiController.getConversations(team.id, owner.id))[0].title)
      .toBe("Summarize private revenue notes");
    await conversation.update({ title: "Revenue review" });
    expect((await AiController.getConversations(team.id, owner.id))[0].title).toBe("Revenue review");
  });

  it("names a promoted Home session from its first question", async () => {
    const { owner, team } = await createOwnedConversation(models);
    const runtimeCache = require("../../modules/runtimeCache");
    const { getObservationAccess } = require("../../modules/observations/access");
    const { getWorkspaceAccessEnvelope } = require("../../modules/workspaceContext/accessEnvelope");
    const envelope = await getWorkspaceAccessEnvelope(await getObservationAccess(team.id, owner.id));
    const sessionId = "11111111-1111-4111-8111-111111111111";
    await runtimeCache.setAiSession({
      teamId: team.id, userId: owner.id, sessionId,
      payload: { accessVersion: envelope.accessVersion, context: [], messageCount: 1, history: [
        { role: "user", content: "Show visits by country" },
        { role: "assistant", content: "# Next steps\nConnect your data source." },
      ] },
    });
    const result = await AiController.promoteSession({ teamId: team.id, userId: owner.id, sessionId });
    const saved = await models.AiConversation.findByPk(result.aiConversationId);
    expect(saved.title).toBe("Show visits by country");
  });

  it("keeps the question and title when a response fails", async () => {
    const { owner, team } = await createOwnedConversation(models);
    await models.TeamRole.update({ role: "projectViewer" }, { where: { user_id: owner.id, team_id: team.id } });
    const count = vi.spyOn(models.AiMessage, "count").mockRejectedValueOnce(new Error("Response unavailable"));
    try {
      await expect(AiController.respond({ teamId: team.id, userId: owner.id, message: "Create a chart" }))
        .rejects.toThrow("Response unavailable");
      const saved = await models.AiConversation.findOne({ where: { team_id: team.id, title: "Create a chart" } });
      expect(saved.status).toBe("error");
      expect(saved.message_count).toBe(1);
      const messages = await models.AiMessage.findAll({ where: { conversation_id: saved.id } });
      expect(messages.map((message) => message.content)).toEqual(["Create a chart"]);
    } finally {
      count.mockRestore();
    }
  });
  it("assigns an older chat explicitly, filters chart history before pagination, and keeps its target fixed", async () => {
    const { owner, otherUser, team, conversation } = await createOwnedConversation(models);
    const project = await models.Project.create(projectFactory.build({ team_id: team.id }));
    const chart = await models.Chart.create({ name: "Revenue", type: "bar", project_id: project.id });
    const otherChart = await models.Chart.create({ name: "Orders", type: "bar", project_id: project.id });
    await models.AiConversationContext.create({
      conversation_id: conversation.id, team_id: team.id, entity_type: "chart", entity_id: String(chart.id),
    });
    const unassigned = await AiController.getConversation(conversation.id, team.id, owner.id);
    expect(unassigned.studio_chart_id).toBeNull();
    await expect(AiController.assignStudioChart(conversation.id, team.id, otherUser.id, chart.id))
      .rejects.toMatchObject({ statusCode: 403 });
    const assigned = await AiController.assignStudioChart(conversation.id, team.id, owner.id, chart.id);
    expect(assigned.studio_chart_id).toBe(chart.id);
    expect(assigned.studioChart).toMatchObject({ id: chart.id, project_id: project.id, name: "Revenue" });
    await expect(AiController.assignStudioChart(conversation.id, team.id, owner.id, otherChart.id))
      .rejects.toMatchObject({ statusCode: 409 });
    await models.AiConversation.create({ team_id: team.id, user_id: owner.id, title: "Other chart", studio_chart_id: otherChart.id });
    const page = await AiController.getConversations(team.id, owner.id, 1, 0, chart.id);
    expect(page.map((item) => item.id)).toEqual([conversation.id]);
    expect(page[0].studioChart.id).toBe(chart.id);
    expect(await AiController.getConversations(team.id, owner.id, 1, 1, chart.id)).toEqual([]);
    expect(await AiController.getConversations(team.id, otherUser.id, 20, 0, chart.id)).toEqual([]);
    await expect(AiController.respond({
      teamId: team.id, userId: owner.id, aiConversationId: conversation.id,
      activeChartId: otherChart.id, message: "Change this chart",
    })).rejects.toMatchObject({ statusCode: 409 });
    const otherTeam = await models.Team.create(teamFactory.build());
    await expect(AiController.getConversation(conversation.id, otherTeam.id, owner.id))
      .rejects.toMatchObject({ statusCode: 404 });
    await chart.destroy();
    const unavailable = await AiController.getConversation(conversation.id, team.id, owner.id);
    expect(unavailable.studio_chart_id).toBe(chart.id);
    expect(unavailable.studioChart).toBeNull();
    expect(unavailable.full_history[0].content).toBe("Summarize private revenue notes");
    await expect(AiController.respond({
      teamId: team.id, userId: owner.id, aiConversationId: conversation.id, message: "Continue",
    })).rejects.toMatchObject({ statusCode: 403 });
    await expect(AiController.respond({
      teamId: team.id, userId: owner.id, aiConversationId: conversation.id,
      action: { type: "confirm_pending_action", actionId: "11111111-1111-4111-8111-111111111111" },
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects ambiguous legacy chats and removes a lost chart destination without exposing its name", async () => {
    const { owner, team, conversation } = await createOwnedConversation(models);
    const project = await models.Project.create(projectFactory.build({ team_id: team.id }));
    const chart = await models.Chart.create({ name: "Private chart", type: "bar", project_id: project.id });
    const otherChart = await models.Chart.create({ name: "Other", type: "bar", project_id: project.id });
    await models.AiConversationContext.bulkCreate([chart, otherChart].map((item) => ({
      conversation_id: conversation.id, team_id: team.id, entity_type: "chart", entity_id: String(item.id),
    })));
    await expect(AiController.assignStudioChart(conversation.id, team.id, owner.id, chart.id))
      .rejects.toMatchObject({ statusCode: 400 });
    await conversation.update({ studio_chart_id: chart.id });
    await models.TeamRole.update({ role: "projectViewer", projects: [] }, { where: { team_id: team.id, user_id: owner.id } });
    expect((await AiController.getConversation(conversation.id, team.id, owner.id)).studioChart).toBeNull();
    expect((await AiController.getConversations(team.id, owner.id))[0].studioChart).toBeNull();
    await expect(AiController.getConversations(team.id, owner.id, 20, 0, chart.id))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it("saves a new studio target and resumes it without a client chart target", async () => {
    const { owner, team } = await createOwnedConversation(models);
    const project = await models.Project.create(projectFactory.build({ team_id: team.id }));
    const chart = await models.Chart.create({ name: "Read-only chart", type: "bar", project_id: project.id });
    await models.TeamRole.update({ role: "projectViewer", projects: [project.id] }, {
      where: { user_id: owner.id, team_id: team.id },
    });
    const result = await AiController.respond({
      teamId: team.id, userId: owner.id, activeChartId: chart.id, message: "Create a dashboard",
    });
    const saved = await AiController.getConversation(result.aiConversationId, team.id, owner.id);
    expect(saved.studio_chart_id).toBe(chart.id);
    expect(saved.context).toContainEqual(expect.objectContaining({ entity_type: "chart", id: chart.id }));
    await AiController.respond({
      teamId: team.id, userId: owner.id, aiConversationId: saved.id, context: [], message: "Create a chart",
    });
    const resumed = await AiController.getConversation(saved.id, team.id, owner.id);
    expect(resumed.studio_chart_id).toBe(chart.id);
    expect(resumed.context).toContainEqual(expect.objectContaining({ entity_type: "chart", id: chart.id }));
    expect(resumed.full_history.filter((message) => message.role === "user")).toHaveLength(2);
  });

});
