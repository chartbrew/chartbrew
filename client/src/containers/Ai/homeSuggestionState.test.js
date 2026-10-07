import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeSuggestionContext, keepSuggestionOrder } from "./homeSuggestionState.js";
import { getHomeSuggestions } from "../Home/homeOnboardingState.js";

test("empty workspaces and viewers retain permitted defaults", () => {
  assert.deepEqual(getHomeSuggestions({ content: { canConfigureTeam: true } }), ["What can I ask?"]);
  const defaults = getHomeSuggestions({ content: { canConfigureTeam: false }, dataHealth: { count: 1 } });
  assert.equal(defaults.some((item) => item.includes("fix")), false);
});

test("suggestion context preserves manual selections and rejects overflow", () => {
  const project = { entity_type: "project", id: 1 };
  const chart = { entity_type: "chart", id: 2 };
  assert.deepEqual(mergeSuggestionContext([project], [project, chart]), [project, chart]);
  assert.equal(mergeSuggestionContext(Array.from({ length: 10 }, (_, id) => ({ entity_type: "chart", id })), [project]), null);
});

test("editing preserves order but removes forbidden suggestions and restores defaults", () => {
  const first = { id: "a" };
  const second = { id: "b" };
  assert.deepEqual(keepSuggestionOrder([first, second], [second, first], true), [first, second]);
  assert.deepEqual(keepSuggestionOrder([first, second], [second], true), [second]);
  assert.deepEqual(keepSuggestionOrder([first], ["What can I ask?"], true), ["What can I ask?"]);
});
