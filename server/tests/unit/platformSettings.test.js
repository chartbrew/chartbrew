import { afterEach, describe, expect, it } from "vitest";

const {
  PLATFORM_SETTING_DEFINITIONS,
  applyPlatformSettingOverrides,
  validateSettingValue,
} = require("../../modules/platformSettings/configuration.js");
const {
  DEFAULT_DATASET_INTELLIGENCE_POLICY,
  DEFAULT_OBSERVATION_POLICY,
  DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY,
  getEnvIntelligencePolicy,
} = require("../../modules/intelligence/envPolicyProvider.js");

describe("Platform settings configuration", () => {
  afterEach(() => {
    delete process.env.CB_OPENAI_API_KEY;
  });

  it("does not register secrets or internal model selection", () => {
    const keys = PLATFORM_SETTING_DEFINITIONS.map((definition) => definition.key);
    expect(keys).toHaveLength(13);
    expect(keys).not.toContain("workspaceOrchestrator.plannerModel");
    expect(keys).not.toContain("workspaceOrchestrator.workerModel");
    expect(keys).not.toContain("observations.llmAuditMode");
    expect(keys).not.toContain("datasetIntelligence.maxSampleRows");
    expect(keys).not.toContain("workspaceOrchestrator.maximumWorkersPerRequest");
    expect(keys.join(" ")).not.toMatch(/api.?key|password|secret/i);
  });

  it("validates values before they become overrides", () => {
    expect(validateSettingValue("workspaceOrchestrator.enabled", false)).toBe(false);
    expect(validateSettingValue(
      "workspaceOrchestrator.maximumRequestTimeSeconds",
      "120"
    )).toBe(120);
    expect(validateSettingValue("workspaceOrchestrator.analysisDepth", "extended"))
      .toBe("extended");
    expect(() => validateSettingValue(
      "workspaceOrchestrator.maximumModelTokensPerRequest",
      9999
    )).toThrow(/between 10000 and 250000/);
    expect(() => validateSettingValue(
      "workspaceOrchestrator.analysisDepth",
      "unlimited"
    )).toThrow(/invalid value/);
    expect(() => validateSettingValue("unknown.setting", true)).toThrow(/Unknown/);
  });

  it("uses quality-first AI and reporting defaults", () => {
    expect(DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY).toMatchObject({
      analysisDepth: "thorough",
      kpiReviewWritesEnabled: true,
      maximumContextCharacters: 240000,
      maximumModelTokensPerRequest: 80000,
      maximumRequestTimeSeconds: 90,
      maximumSummaryLookbackDays: 365,
      maximumTotalToolCalls: 12,
      maximumWorkersPerRequest: 3,
      metricMonitorWritesEnabled: true,
    });

    expect(getEnvIntelligencePolicy({
      CB_WORKSPACE_ANALYSIS_DEPTH: "extended",
      NODE_ENV: "production",
    }).workspaceOrchestrator).toMatchObject({
      analysisDepth: "extended",
      maximumTotalToolCalls: 18,
      maximumWorkersPerRequest: 4,
    });
  });

  it("applies only registered settings without changing the base policy", () => {
    const basePolicy = {
      datasetIntelligence: { ...DEFAULT_DATASET_INTELLIGENCE_POLICY },
      observations: { ...DEFAULT_OBSERVATION_POLICY },
      workspaceOrchestrator: { ...DEFAULT_WORKSPACE_ORCHESTRATOR_POLICY },
    };
    const policy = applyPlatformSettingOverrides(basePolicy, {
      "workspaceOrchestrator.enabled": false,
      "workspaceOrchestrator.analysisDepth": "extended",
      "workspaceOrchestrator.maximumRequestTimeSeconds": 120,
      "observations.maximumMonitors": 25,
      "unknown.setting": "ignored",
    });

    expect(policy.workspaceOrchestrator.enabled).toBe(false);
    expect(policy.workspaceOrchestrator.maximumWorkersPerRequest).toBe(4);
    expect(policy.workspaceOrchestrator.maximumTotalToolCalls).toBe(18);
    expect(policy.workspaceOrchestrator.maximumRequestTimeMs).toBe(120000);
    expect(policy.observations.maximumMonitors).toBe(
      DEFAULT_OBSERVATION_POLICY.maximumMonitors
    );
    expect(basePolicy.workspaceOrchestrator.enabled).toBe(true);
    expect(basePolicy.workspaceOrchestrator.maximumWorkersPerRequest).toBe(3);
    expect(policy.unknown).toBeUndefined();
  });
});
