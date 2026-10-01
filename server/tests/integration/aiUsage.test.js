import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { userFactory } from "../factories/userFactory.js";
import { teamFactory } from "../factories/teamFactory.js";
import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

const usage = require("../../modules/ai/usage");
const { getAiUsage } = require("../../controllers/AiController");
let db;

describe("AI usage storage", () => {
  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    db = await getModels();
  });
  afterEach(() => vi.restoreAllMocks());

  it("records returned usage after the chat is deleted and keeps Cloud's saved cost", async () => {
    const team = await db.Team.create(teamFactory.build());
    const user = await db.User.create(userFactory.build());
    const conversation = await db.AiConversation.create({
      team_id: team.id, user_id: user.id, title: "Usage test",
    });
    const response = { id: "response-test", model: "resolved-model", usage: {
      input_tokens: 100, output_tokens: 30, total_tokens: 130,
      input_tokens_details: { cached_tokens: 60 }, output_tokens_details: { reasoning_tokens: 20 },
    } };
    const create = vi.fn(async () => {
      await db.AiUsage.update({ conversation_id: null, cost_micros: 250 }, {
        where: { conversation_id: conversation.id },
      });
      await conversation.destroy();
      return response;
    });
    const after = vi.spyOn(usage, "afterAiUsage");

    const result = await usage.withAiUsageContext({ teamId: team.id, conversationId: conversation.id }, async () => {
      await usage.callAiProvider({ client: { responses: { create } }, request: { model: "requested-model" }, purpose: "ask_data" });
      return { usageRecords: [] };
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(result.usage).toEqual({ prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 });
    expect(result.usageComplete).toBe(true);
    expect(after).toHaveBeenCalledTimes(1);
    const record = await db.AiUsage.findOne({ where: { team_id: team.id } });
    expect(record.toJSON()).toMatchObject({
      conversation_id: null, usage_status: "reported", request_id: result.requestId,
      cached_tokens: 60, reasoning_tokens: 20, provider_usage: response.usage,
    });
    expect(Number(record.cost_micros)).toBe(250);
    expect((await getAiUsage(team.id)).total).toMatchObject({ total_tokens: 130, api_calls: 1 });
    const groups = await usage.getUsageSummary({ teamId: team.id, from: "2020-01-01", to: "2100-01-01" });
    expect(groups).toHaveLength(1);
    expect(Number(groups[0].total_tokens)).toBe(130);
  });
});
