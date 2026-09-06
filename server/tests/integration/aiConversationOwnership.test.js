import {
  beforeAll, describe, expect, it, vi
} from "vitest";

import { testDbManager } from "../helpers/index.js";
import { getModels } from "../helpers/dbHelpers.js";
import { userFactory } from "../factories/userFactory.js";
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
});
