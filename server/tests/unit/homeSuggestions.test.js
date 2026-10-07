import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { Sequelize, DataTypes } = require("sequelize");
const db = require("../../models/models");
const service = require("../../modules/ai/homeSuggestions/service");
const rules = require("../../modules/ai/homeSuggestions/rules");
const { setPlatformSettingOverrides } = require("../../modules/platformSettings/runtime");
const sequelize = new Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false });
const stateModel = require("../../models/models/aiHomeState")(sequelize, DataTypes);
const access = { teamId: 7, userId: 42, role: "projectViewer", projectIds: [10], allProjects: false, canConfigureTeam: false, teamAiEnabled: true };
const now = new Date("2026-10-06T12:00:00Z");
let team;
let role;
let projects;
let create;
let provider;
let output;

describe("personal Home suggestions", () => {
  beforeAll(async () => { await stateModel.sync(); });
  beforeEach(async () => {
    await stateModel.destroy({ where: {} });
    vi.stubEnv("CB_OPENAI_API_KEY_DEV", "test-key");
    setPlatformSettingOverrides({ "workspaceOrchestrator.enabled": true, "workspaceOrchestrator.externalLearningContextEnabled": false });
    team = { aiEnabled: true, aiSuggestionsEnabled: true, updatedAt: new Date("2026-10-01") };
    role = { role: "projectViewer", projects: [10], Team: team };
    projects = [{ id: 10, name: "Sales", updatedAt: now }];
    for (const method of ["findOne", "findOrCreate", "update", "findAll", "destroy"]) {
      vi.spyOn(db.AiHomeState, method).mockImplementation((...args) => stateModel[method](...args));
    }
    vi.spyOn(db.Team, "findByPk").mockImplementation(async () => team);
    vi.spyOn(db.TeamRole, "findOne").mockImplementation(async () => role);
    vi.spyOn(db.User, "findByPk").mockResolvedValue({ email: "test@example.com" });
    vi.spyOn(db.Project, "findAll").mockImplementation(async () => projects);
    vi.spyOn(db.Project, "findOne").mockImplementation(async () => projects.length ? { ...projects[0], team_id: 7 } : null);
    vi.spyOn(db.Chart, "count").mockResolvedValue([]);
    for (const model of ["Chart", "ChartVersion", "Dataset", "Observation", "AiMemory", "AiConversation", "AiConversationContext", "AiMessage"]) {
      vi.spyOn(db[model], "findAll").mockResolvedValue([]);
    }
    vi.spyOn(db.AiUsage, "create").mockResolvedValue({});
    vi.spyOn(db.AiUsage, "update").mockResolvedValue([1]);
    output = { suggestions: [{ title: "Review sales results", prompt: "Summarize my saved sales dashboard.", action: "report", refs: ["project:10"] }], memories: [] };
    create = vi.fn(async () => ({ id: "response", output_text: JSON.stringify(output), usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 } }));
    provider = { model: "test-model", client: { responses: { create } } };
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); setPlatformSettingOverrides({}); });
  afterAll(() => sequelize.close());

  async function activeState() {
    return stateModel.create({ team_id: 7, user_id: 42, last_active_at: now, payload: {} });
  }

  it("generates once, records internal use and skips unchanged context", async () => {
    await activeState();
    expect(await service.generate(7, 42, { provider, now })).toBe("generated");
    expect(create).toHaveBeenCalledTimes(1);
    const request = create.mock.calls[0][0];
    expect(request.tools).toBeUndefined();
    expect(request.input).toMatch(/json/i);
    expect(request.max_output_tokens).toBe(1500);
    expect(Buffer.byteLength(request.instructions + request.input)).toBeLessThan(6000);
    expect(db.AiUsage.create).toHaveBeenCalledWith(expect.objectContaining({ activity: "internal", purpose: "home_suggestions", context_manifest: expect.any(Object) }));
    const state = await stateModel.findOne();
    expect(state.getDataValue("payload")).not.toContain("Review sales");
    expect(await service.generate(7, 42, { provider, now: new Date(now.getTime() + rules.DAY) })).toBe("unchanged_or_inactive");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("reports an empty model result separately from generated suggestions", async () => {
    await activeState();
    output.suggestions = [];
    expect(await service.generate(7, 42, { provider, now })).toBe("no_suggestions");
  });

  it("keeps the latest chart edits first in the bounded input", async () => {
    const state = await activeState();
    await state.update({ payload: { edits: [
      { ref: "chart:99", at: now.toISOString() },
      { ref: "chart:1", at: new Date(now - rules.DAY).toISOString() },
    ] } });
    db.Chart.findAll.mockResolvedValue([
      { id: 1, name: "Older chart", project_id: 10, Project: { name: "Sales" } },
      { id: 99, name: "Latest chart", project_id: 10, Project: { name: "Sales" } },
    ]);
    const snapshot = await service.snapshotFor(access, state, await service.settings(access), now);
    expect(snapshot.resources[0].ref).toBe("chart:99");
  });

  it("refreshes unchanged context manually but keeps an atomic five-minute limit", async () => {
    await activeState();
    await service.generate(7, 42, { provider, now });
    expect(await service.generate(7, 42, { provider, now, manual: true })).toBe("already_claimed");
    const later = new Date(now.getTime() + 6 * 60000);
    const results = await Promise.all([
      service.generate(7, 42, { provider, now: later, manual: true }),
      service.generate(7, 42, { provider, now: later, manual: true }),
    ]);
    expect(results).toContain("generated");
    expect(create).toHaveBeenCalledTimes(2);
    team.aiSuggestionsEnabled = false;
    expect(await service.generate(7, 42, { provider, now: later, manual: true })).toBe("disabled");
  });

  it("prevents concurrent calls and retains the attempt limit after failure", async () => {
    await activeState();
    create.mockRejectedValue(new Error("Provider unavailable"));
    const results = await Promise.allSettled([
      service.generate(7, 42, { provider, now }), service.generate(7, 42, { provider, now }),
    ]);
    expect(results.some((item) => item.status === "rejected")).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(await service.generate(7, 42, { provider, now })).toBe("unchanged_or_inactive");
  });

  it("does not call the provider for inactive users or disabled teams", async () => {
    const state = await activeState();
    await state.update({ last_active_at: new Date(now - 8 * rules.DAY) });
    expect(await service.generate(7, 42, { provider, now })).toBe("unchanged_or_inactive");
    team.aiSuggestionsEnabled = false;
    expect(await service.generate(7, 42, { provider, now })).toBe("disabled");
    team.aiSuggestionsEnabled = true;
    team.aiEnabled = false;
    expect(await service.generate(7, 42, { provider, now })).toBe("disabled");
    expect(create).not.toHaveBeenCalled();
  });

  it("discards a result when the setting or access changes during generation", async () => {
    await activeState();
    create.mockImplementation(async () => {
      team.aiSuggestionsEnabled = false;
      return { output_text: JSON.stringify(output), usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
    });
    expect(await service.generate(7, 42, { provider, now })).toBe("discarded");
    expect((await stateModel.findOne()).signature).toBeNull();
  });

  it("does not return a saved suggestion after access is removed", async () => {
    await activeState();
    await service.generate(7, 42, { provider, now });
    projects = [];
    expect(await service.readSuggestions({ ...access, projectIds: [] })).toEqual([]);
  });

  it("never reads personal memory or chat text when external sharing is off", async () => {
    const state = await activeState();
    const config = await service.settings(access);
    const snapshot = await service.snapshotFor(access, state, config, now);
    expect(snapshot.evidence).toEqual([]);
    expect(db.AiMemory.findAll).not.toHaveBeenCalled();
    expect(db.AiMessage.findAll).not.toHaveBeenCalled();
  });

  it("rejects invented resources, unavailable actions, long titles, and duplicate candidates", () => {
    const snapshot = { resources: [{ ref: "project:10" }], actions: ["report"], evidence: [] };
    const candidate = output.suggestions[0];
    const suggestions = [candidate, { ...candidate, refs: ["project:99"] }, { ...candidate, action: "create_chart" }, { ...candidate, title: "x".repeat(49) }];
    expect(rules.validateOutput({ suggestions, memories: [] }, snapshot).suggestions).toHaveLength(1);
    expect(rules.validateOutput({ suggestions: [candidate, candidate], memories: [] }, snapshot).suggestions).toHaveLength(1);
  });

  it("does not regenerate only because old evidence expires", () => {
    const state = { last_active_at: now, signature: "old", payload: { accessVersion: "v1", inputHashes: ["resource", "expired-chat"] } };
    expect(rules.isDue(state, "new", now, { accessVersion: "v1", inputHashes: ["resource"] })).toBe(false);
    expect(rules.isDue(state, "new", now, { accessVersion: "v1", inputHashes: ["resource", "new-chat"] })).toBe(true);
  });

  it("accepts useful chart follow-ups without chat memories", () => {
    const snapshot = { resources: [{ ref: "chart:10" }], actions: ["report"], evidence: [] };
    const result = rules.validateOutput({ suggestions: [{
      title: "Review email delivery anomalies", prompt: "Does my email delivery chart show an anomaly?",
      action: "report", refs: ["chart:10"],
    }], memories: [] }, snapshot);
    expect(result.suggestions).toHaveLength(1);
    expect(result.memories).toEqual([]);
    expect(rules.validateOutput({ suggestions: [{
      title: "Delete delivery chart", prompt: "Delete my email delivery chart.", action: "report", refs: ["chart:10"],
    }], memories: [] }, snapshot).suggestions).toEqual([]);
  });

  it("uses current AI capabilities for editors and viewers", () => {
    const envelope = { editableProjectIds: [10], metricMonitorWritesEnabled: true, kpiReviewWritesEnabled: true, canCreatePersonalKpiReview: true };
    expect(rules.allowedActions(access, envelope, { metricRecommendationsEnabled: true })).toEqual(["report"]);
    const editor = rules.allowedActions({ ...access, role: "projectEditor" }, envelope, { metricRecommendationsEnabled: true });
    expect(editor).toContain("analyze_dataset");
    expect(editor).not.toContain("create_chart");
  });
});
