import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { Sequelize, DataTypes } = require("sequelize");
const db = require("../../models/models");
const usage = require("../../modules/ai/usage");
const migration = require("../../models/migrations/20261001110000-ai-usage-metering");
const defineModel = require("../../models/models/aiusage");
const sequelize = new Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false });
const model = defineModel(sequelize, DataTypes);
const fields = ["request_id", "provider", "provider_response_id", "activity", "usage_status",
  "cached_tokens", "reasoning_tokens", "provider_usage"];
let legacyRecord;
const request = { model: "requested-model" };
const response = { id: "response-1", model: "resolved-model", usage: {
  input_tokens: 100, output_tokens: 30, total_tokens: 130,
  input_tokens_details: { cached_tokens: 60 }, output_tokens_details: { reasoning_tokens: 20 },
} };

function call(create = vi.fn().mockResolvedValue(response), options = {}) {
  return usage.callAiProvider({ client: { responses: { create } }, request, purpose: "ask_data", ...options });
}

describe("AI usage records", () => {
  beforeAll(async () => {
    await model.sync();
    for (const name of fields) await sequelize.getQueryInterface().removeColumn("AiUsage", name);
    await sequelize.getQueryInterface().bulkInsert("AiUsage", [{
      id: "legacy", team_id: 7, model: "old-model", total_tokens: 12,
      createdAt: new Date(), updatedAt: new Date(),
    }]);
    await migration.up(sequelize.getQueryInterface());
    legacyRecord = (await model.findByPk("legacy")).toJSON();
  });
  beforeEach(async () => {
    await model.destroy({ where: {} });
    vi.spyOn(db.AiUsage, "create").mockImplementation((...args) => model.create(...args));
    vi.spyOn(db.AiUsage, "update").mockImplementation((...args) => model.update(...args));
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => sequelize.close());

  it("keeps old usage separate after migration", () => {
    expect(legacyRecord).toMatchObject({
      total_tokens: 12, usage_status: "legacy", activity: "legacy", cached_tokens: null,
    });
  });

  it("can resume an already applied migration", async () => {
    await expect(migration.up(sequelize.getQueryInterface())).resolves.toBeUndefined();
  });

  it("saves usage before output validation, without counting cached or reasoning tokens twice", async () => {
    const create = vi.fn(async () => {
      expect(await model.count({ where: { usage_status: "pending" } })).toBe(1);
      return response;
    });
    await expect(usage.withAiUsageContext({ teamId: 7 }, async () => {
      await call(create);
      throw new Error("Output validation failed");
    })).rejects.toThrow("Output validation failed");
    const record = await model.findOne();
    expect(record.toJSON()).toMatchObject({
      team_id: 7, model: "resolved-model", provider: "openai", provider_response_id: "response-1",
      prompt_tokens: 100, completion_tokens: 30, total_tokens: 130,
      cached_tokens: 60, reasoning_tokens: 20, usage_status: "reported", cost_micros: null,
      provider_usage: response.usage,
    });
    expect(create).toHaveBeenCalledExactlyOnceWith(request, { maxRetries: 0 });
  });

  it("adds nested calls once and keeps teams and requests separate during parallel work", async () => {
    const results = await Promise.all([7, 8].map((teamId) => usage.withAiUsageContext({ teamId }, async () => {
      await call();
      await usage.withAiUsageContext({ teamId }, () => call());
      return { usageRecords: [], contextManifest: { purpose: "ask_data" } };
    })));
    expect(await model.count()).toBe(4);
    expect(results[0].requestId).not.toBe(results[1].requestId);
    for (const [index, result] of results.entries()) {
      expect(result.usage.total_tokens).toBe(260);
      expect(result.usageRecords).toHaveLength(2);
      expect(result.usageRecords.every((record) => record.team_id === index + 7)).toBe(true);
      expect(new Set(result.usageRecords.map((record) => record.request_id))).toEqual(new Set([result.requestId]));
    }
  });

  it("does not make a provider call without valid team context or a saved start record", async () => {
    const create = vi.fn();
    await expect(call(create)).rejects.toThrow("team context");
    await expect(usage.withAiUsageContext({ teamId: 0 }, () => call(create))).rejects.toThrow("valid team");
    await expect(usage.withAiUsageContext({ teamId: 7 }, () => {
      return usage.withAiUsageContext({ teamId: 8 }, () => call(create));
    })).rejects.toThrow("valid team");
    db.AiUsage.create.mockRejectedValueOnce(new Error("Database unavailable"));
    await expect(usage.withAiUsageContext({ teamId: 7 }, () => call(create))).rejects.toThrow("Database unavailable");
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps timeouts and missing usage unknown instead of reporting zero tokens", async () => {
    await expect(usage.withAiUsageContext({ teamId: 7 }, () => {
      return call(vi.fn().mockRejectedValue(new Error("Timeout")));
    })).rejects.toThrow("Timeout");
    await usage.withAiUsageContext({ teamId: 7 }, () => call(vi.fn().mockResolvedValue({ id: "missing" })));
    const records = await model.findAll();
    expect(records).toHaveLength(2);
    expect(records.every((record) => record.usage_status === "unknown" && record.total_tokens === null)).toBe(true);
  });

  it("retains a pending record if the final database write fails, without repeating the provider call", async () => {
    const create = vi.fn().mockResolvedValue(response);
    db.AiUsage.update.mockRejectedValueOnce(new Error("Database unavailable"));
    await expect(usage.withAiUsageContext({ teamId: 7 }, () => call(create))).rejects.toThrow("Database unavailable");
    expect(create).toHaveBeenCalledTimes(1);
    expect((await model.findOne()).usage_status).toBe("pending");
  });

  it("does not restore a chat reference removed during a provider call", async () => {
    const create = vi.fn(async () => {
      await model.update({ conversation_id: null }, { where: { team_id: 7 } });
      return response;
    });
    await usage.withAiUsageContext({ teamId: 7, conversationId: "removed-chat" }, () => call(create));
    expect((await model.findOne()).toJSON()).toMatchObject({ conversation_id: null, usage_status: "reported" });
  });

  it("does not overwrite a cost saved by Cloud while a provider call runs", async () => {
    vi.spyOn(usage, "beforeAiCall").mockImplementation(async (record) => {
      await model.update({ cost_micros: 250 }, { where: { id: record.id } });
    });
    await usage.withAiUsageContext({ teamId: 7 }, () => call());
    expect(Number((await model.findOne()).cost_micros)).toBe(250);
  });

  it("calls the billing hook after persistence and keeps the record if delivery fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(usage, "afterAiUsage").mockImplementation(async (record) => {
      expect((await model.findByPk(record.id)).usage_status).toBe("reported");
      throw new Error("Cloud unavailable");
    });
    await expect(usage.withAiUsageContext({ teamId: 7 }, () => call())).resolves.toBe(response);
    expect(await model.count()).toBe(1);
    expect(usage.afterAiUsage).toHaveBeenCalledTimes(1);
  });

  it("lets Cloud reject a call before provider work without reporting token use", async () => {
    const create = vi.fn();
    vi.spyOn(usage, "beforeAiCall").mockRejectedValue(new Error("Plan limit reached"));
    await expect(usage.withAiUsageContext({ teamId: 7 }, () => call(create))).rejects.toThrow("Plan limit reached");
    expect(create).not.toHaveBeenCalled();
    expect((await model.findOne()).toJSON()).toMatchObject({ usage_status: "rejected", total_tokens: null });
  });

  it("accepts Chat Completions usage and calculates a missing total from known counts", async () => {
    const create = vi.fn().mockResolvedValue({ usage: {
      prompt_tokens: 20, completion_tokens: 10,
      prompt_tokens_details: { cached_tokens: 12 }, completion_tokens_details: { reasoning_tokens: 3 },
    } });
    await usage.withAiUsageContext({ teamId: 7, activity: "background" }, () => usage.callAiProvider({
      client: { chat: { completions: { create } } }, api: "chat", request, purpose: "dataset_enrichment",
    }));
    expect((await model.findOne()).toJSON()).toMatchObject({
      activity: "background", total_tokens: 30, cached_tokens: 12, reasoning_tokens: 3, usage_status: "reported",
    });
  });

  it("returns zero usage without adding a provider record for deterministic replies", async () => {
    const result = await usage.withAiUsageContext({ teamId: 7 }, async () => ({
      usageRecords: [{ model: "deterministic", total_tokens: 0 }],
    }));
    expect(result.usageRecords).toEqual([]);
    expect(result.usage.total_tokens).toBe(0);
    expect(await model.count()).toBe(0);
  });

  it("uses half-open billing periods and separates model, purpose, activity, and unknown use", async () => {
    for (const [teamId, activity, createdAt, usageStatus] of [
      [7, "interactive", "2026-10-01", "reported"],
      [7, "internal", "2026-10-01", "reported"],
      [7, "interactive", "2026-10-02", "unknown"],
      [7, "interactive", "2026-11-01", "reported"],
      [8, "interactive", "2026-10-01", "reported"],
    ]) {
      await model.create({ team_id: teamId, model: "test", activity, usage_status: usageStatus,
        total_tokens: usageStatus === "unknown" ? null : 10, createdAt: new Date(createdAt) });
    }
    const rows = await usage.getUsageSummary({
      teamId: 7, from: "2026-10-01", to: "2026-11-01", activity: "interactive",
    }, model);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.usage_status === "reported")).toMatchObject({ records: 1, total_tokens: 10 });
    expect(rows.find((row) => row.usage_status === "unknown")).toMatchObject({ records: 1, total_tokens: null });
    await expect(usage.getUsageSummary({ teamId: 7, from: "invalid", to: "2026-11-01" }, model)).rejects.toThrow("valid usage period");
  });

  it("removes only the new fields when the migration is reversed", async () => {
    await migration.down(sequelize.getQueryInterface());
    const columns = await sequelize.getQueryInterface().describeTable("AiUsage");
    expect(columns.request_id).toBeUndefined();
    expect(columns.total_tokens).toBeDefined();
  });
});
