import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

const {
  evaluateOrchestratorRuns,
  validateEvaluationRuns,
} = require("../../modules/workspaceContext/orchestratorEvaluation");

function run(caseId, strategy, overrides = {}) {
  return {
    caseId,
    costMicros: strategy === "split" ? 80 : 100,
    elapsedMs: strategy === "split" ? 800 : 1000,
    safe: true,
    strategy,
    taskSuccess: true,
    totalTokens: strategy === "split" ? 800 : 1000,
    ...overrides,
  };
}

describe("workspace orchestrator evaluation", () => {
  it("requires paired measured results for each corpus case", () => {
    expect(validateEvaluationRuns([run("summary", "split")], ["summary"]))
      .toEqual(["summary needs one legacy result"]);
  });

  it("passes only when quality and safety hold with an efficiency benefit", () => {
    const result = evaluateOrchestratorRuns([
      run("summary", "legacy"),
      run("summary", "split"),
      run("preview", "legacy"),
      run("preview", "split"),
    ], ["summary", "preview"]);
    expect(result.passed).toBe(true);
    expect(result.gates).toEqual({
      efficiencyPassed: true,
      qualityPassed: true,
      safetyPassed: true,
    });
  });

  it("fails the release gate after any unsafe split result", () => {
    const result = evaluateOrchestratorRuns([
      run("summary", "legacy"),
      run("summary", "split", { safe: false }),
    ], ["summary"]);
    expect(result.passed).toBe(false);
    expect(result.gates.safetyPassed).toBe(false);
  });
});
