import {
  beforeAll, describe, expect, it
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
});
