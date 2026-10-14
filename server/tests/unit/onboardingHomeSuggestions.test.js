import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { Sequelize, DataTypes } = require("sequelize");
const db = require("../../models/models");
const service = require("../../modules/ai/homeSuggestions/onboarding");
const { setPlatformSettingOverrides } = require("../../modules/platformSettings/runtime");
const migration = require("../../models/migrations/20261014120000-onboarding-home-suggestions");
const sequelize = new Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false });
const Profile = require("../../models/models/teambusinessprofile")(sequelize, DataTypes);
const suggestions = [
  { title: "How do trials convert?", prompt: "How can I measure trial conversion for my subscription business?" },
  { title: "What drives renewals?", prompt: "Which renewal metrics should I include in my weekly report?" },
  { title: "Which billing data first?", prompt: "Which billing data should I connect to measure recurring revenue?" },
];
let queue;
let create;
let provider;
let discover;

describe("public onboarding suggestions", () => {
  beforeAll(async () => { await Profile.sync(); });
  beforeEach(async () => {
    await Profile.destroy({ where: {} });
    setPlatformSettingOverrides({ "workspaceOrchestrator.enabled": true });
    for (const method of ["findOne", "update"]) {
      vi.spyOn(db.TeamBusinessProfile, method).mockImplementation((...args) => Profile[method](...args));
    }
    vi.spyOn(db.Team, "findByPk").mockResolvedValue({ aiEnabled: false, aiSuggestionsEnabled: false });
    for (const model of ["Chart", "Dataset", "AiMemory", "AiMessage"]) {
      vi.spyOn(db[model], "findAll").mockRejectedValue(new Error("Private context must not be read"));
    }
    vi.spyOn(db.AiUsage, "create").mockResolvedValue({});
    vi.spyOn(db.AiUsage, "update").mockResolvedValue([1]);
    queue = { add: vi.fn().mockResolvedValue({}) };
    discover = vi.fn().mockResolvedValue({
      businessName: "Public business", description: "Subscription software", metadata: { industry: "Software" },
      logo: { data: "not-for-the-model" },
    });
    create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({ suggestions }),
      usage: { input_tokens: 100, output_tokens: 60, total_tokens: 160 },
    });
    provider = { model: "test-model", client: { responses: { create } } };
  });
  afterEach(() => { vi.restoreAllMocks(); setPlatformSettingOverrides({}); });
  afterAll(() => sequelize.close());

  async function seed() {
    const profile = await Profile.create({ team_id: 7, websiteUrl: "https://example.com/", description: "PRIVATE notes" });
    await service.queueSuggestions(7, queue);
    await profile.reload();
    return profile;
  }

  it("generates with team AI off, uses only public fields, and records home_suggestions usage", async () => {
    const profile = await seed();
    expect(queue.add).toHaveBeenCalledWith("onboardingSuggestions", {
      teamId: 7, requestId: profile.homeSuggestions.requestId,
    }, expect.objectContaining({ attempts: 1 }));
    expect(await service.generateSuggestions(7, profile.homeSuggestions.requestId, { provider, discover })).toBe("generated");
    const request = create.mock.calls[0][0];
    expect(request.input).toContain("Public business");
    expect(request.input).not.toMatch(/PRIVATE|not-for-the-model/);
    expect(request.tools).toBeUndefined();
    expect(db.Team.findByPk).not.toHaveBeenCalled();
    for (const model of ["Chart", "Dataset", "AiMemory", "AiMessage"]) expect(db[model].findAll).not.toHaveBeenCalled();
    expect(db.AiUsage.create).toHaveBeenCalledWith(expect.objectContaining({
      team_id: 7, purpose: "home_suggestions", activity: "internal",
    }));
    expect(await service.readSuggestions({ teamId: 7, canConfigureTeam: true }, {})).toMatchObject({
      starterSuggestions: suggestions.map((item) => ({ ...item, starter: true })), starterSuggestionsPending: false,
    });
    await service.queueSuggestions(7, queue);
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(await service.generateSuggestions(7, profile.homeSuggestions.requestId, { provider, discover })).toBe("discarded");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("keeps the platform AI control in force", async () => {
    const profile = await seed();
    setPlatformSettingOverrides({ "workspaceOrchestrator.enabled": false });
    await expect(service.generateSuggestions(7, profile.homeSuggestions.requestId, { provider, discover }))
      .rejects.toThrow("Platform AI is disabled");
    expect(discover).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("allows a later profile save to retry a failed queue request", async () => {
    await Profile.create({ team_id: 7, websiteUrl: "https://example.com/" });
    queue.add.mockRejectedValueOnce(new Error("Redis unavailable"));
    await expect(service.queueSuggestions(7, queue)).rejects.toThrow();
    const profile = await Profile.findOne();
    expect(profile.homeSuggestions.status).toBe("failed");
    await service.queueSuggestions(7, queue);
    expect(queue.add).toHaveBeenCalledTimes(1);
    await profile.update({ homeSuggestions: {
      ...profile.homeSuggestions, requestedAt: new Date(Date.now() - 6 * 60000).toISOString(),
    } });
    await service.queueSuggestions(7, queue);
    expect(queue.add).toHaveBeenCalledTimes(2);
  });

  it("claims concurrent generation only once", async () => {
    const profile = await seed();
    const results = await Promise.all([
      service.generateSuggestions(7, profile.homeSuggestions.requestId, { provider, discover }),
      service.generateSuggestions(7, profile.homeSuggestions.requestId, { provider, discover }),
    ]);
    expect(results).toContain("generated");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("discards results when the website changes during generation", async () => {
    const profile = await seed();
    create.mockImplementation(async () => {
      await profile.update({ websiteUrl: "https://other.example/" });
      return { output_text: JSON.stringify({ suggestions }) };
    });
    expect(await service.generateSuggestions(7, profile.homeSuggestions.requestId, { provider, discover })).toBe("discarded");
    expect((await service.readSuggestions({ teamId: 7, canConfigureTeam: true }, {})).starterSuggestions).toEqual([]);
    await service.queueSuggestions(7, queue);
    expect(queue.add).toHaveBeenCalledTimes(2);
  });

  it("keeps defaults for failures, missing websites, and unavailable queues", async () => {
    await Profile.create({ team_id: 8 });
    await service.queueSuggestions(8, queue);
    await service.queueSuggestions(8, null);
    expect(queue.add).not.toHaveBeenCalled();
    const profile = await seed();
    discover.mockRejectedValue(new Error("Website unavailable"));
    await expect(service.generateSuggestions(7, profile.homeSuggestions.requestId, { provider, discover })).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
    expect(await service.readSuggestions({ teamId: 7, canConfigureTeam: true }, {})).toEqual({
      starterSuggestions: [], starterSuggestionsPending: false,
    });
  });

  it("records provider usage even when returned suggestions fail validation", async () => {
    const profile = await seed();
    create.mockResolvedValue({ output_text: "{}", usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } });
    await expect(service.generateSuggestions(7, profile.homeSuggestions.requestId, { provider, discover })).rejects.toThrow();
    expect(db.AiUsage.update).toHaveBeenCalledWith(expect.objectContaining({ total_tokens: 15 }), expect.any(Object));
    expect((await profile.reload()).homeSuggestions.status).toBe("failed");
  });

  it("stops waiting after two minutes and excludes viewers and established workspaces", async () => {
    const profile = await seed();
    const access = { teamId: 7, canConfigureTeam: true };
    expect((await service.readSuggestions(access, {})).starterSuggestionsPending).toBe(true);
    await profile.update({ homeSuggestions: { ...profile.homeSuggestions, requestedAt: new Date(Date.now() - 121000).toISOString() } });
    expect((await service.readSuggestions(access, {})).starterSuggestionsPending).toBe(false);
    for (const content of [{ hasConnection: true }, { hasDataset: true }, { hasChart: true }]) {
      expect((await service.readSuggestions(access, content)).starterSuggestions).toEqual([]);
    }
    expect((await service.readSuggestions({ ...access, canConfigureTeam: false }, {})).starterSuggestions).toEqual([]);
  });

  it("rejects too few, duplicate, malformed, and long suggestions", () => {
    for (const value of [{}, { suggestions: [] }, { suggestions: [suggestions[0], suggestions[0], suggestions[2]] },
      { suggestions: [{ ...suggestions[0], title: "x".repeat(29) }, ...suggestions.slice(1)] },
      { suggestions: [{ ...suggestions[0], prompt: "x".repeat(301) }, ...suggestions.slice(1)] }]) {
      expect(() => service.validateSuggestions(value)).toThrow();
    }
  });

  it("adds and removes the profile column", async () => {
    const queryInterface = { addColumn: vi.fn(), removeColumn: vi.fn() };
    await migration.up(queryInterface);
    expect(queryInterface.addColumn).toHaveBeenCalledWith("TeamBusinessProfile", "homeSuggestions", expect.any(Object));
    await migration.down(queryInterface);
    expect(queryInterface.removeColumn).toHaveBeenCalledWith("TeamBusinessProfile", "homeSuggestions");
  });
});
