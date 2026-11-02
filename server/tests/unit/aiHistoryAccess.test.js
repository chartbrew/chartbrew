import { describe, expect, it } from "vitest";

const { buildAccessVersion, canReadHistoryMessage } = require("../../modules/workspaceContext/accessEnvelope");

const scope = {
  editableProjectIds: [1],
  policy: { externalAiEnabled: true, workspaceOrchestratorEnabled: true },
  role: "projectEditor",
  teamId: 10,
  userId: 20,
  visibleProjectIds: [1],
};

function envelope(changes = {}) {
  const historyAccessScope = { ...scope, ...changes };
  return { accessVersion: buildAccessVersion(historyAccessScope), historyAccessScope };
}

function message(changes = {}) {
  return {
    sensitive_workspace_context: true,
    workspace_access_version: buildAccessVersion(scope),
    workspace_access_scope: scope,
    ...changes,
  };
}

describe("AI history access", () => {
  it("keeps earlier answers and tool results when dashboard access grows", () => {
    const current = envelope({ visibleProjectIds: [1, 2], editableProjectIds: [1, 2] });
    for (const role of ["assistant", "tool"]) {
      expect(canReadHistoryMessage(message({ role }), current)).toBe(true);
    }
  });

  it.each([
    { visibleProjectIds: [], editableProjectIds: [] },
    { visibleProjectIds: [2], editableProjectIds: [2] },
    { editableProjectIds: [] },
    { role: "projectViewer" },
    { teamId: 11 },
    { userId: 21 },
    { policy: { externalAiEnabled: false, workspaceOrchestratorEnabled: true } },
  ])("hides sensitive history after a permission or identity change: %j", (changes) => {
    expect(canReadHistoryMessage(message(), envelope(changes))).toBe(false);
  });

  it("keeps the strict version check for legacy messages", () => {
    const legacy = message({ workspace_access_scope: null });
    expect(canReadHistoryMessage(legacy, envelope())).toBe(true);
    expect(canReadHistoryMessage(legacy, envelope({ visibleProjectIds: [1, 2] }))).toBe(false);
    expect(canReadHistoryMessage(message({ workspace_access_scope: {} }), envelope({ visibleProjectIds: [1, 2] }))).toBe(false);
    expect(canReadHistoryMessage(message(), null)).toBe(false);
  });

  it("compares stored JSON by value even when the database reorders keys", () => {
    const reordered = Object.fromEntries(Object.entries(scope).reverse());
    reordered.policy = Object.fromEntries(Object.entries(scope.policy).reverse());
    expect(canReadHistoryMessage(message({ workspace_access_scope: reordered }),
      envelope({ visibleProjectIds: [1, 2] }))).toBe(true);
  });

  it("keeps user messages available when sensitive history is hidden", () => {
    expect(canReadHistoryMessage(message({ role: "user", sensitive_workspace_context: false }),
      envelope({ visibleProjectIds: [], editableProjectIds: [] }))).toBe(true);
  });
});
