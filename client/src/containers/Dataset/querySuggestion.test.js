import assert from "node:assert/strict";
import test from "node:test";

import { resolveQuerySuggestion } from "./querySuggestion.js";

test("AI suggestions preserve edits made during generation and support undo", () => {
  const response = { query: "SELECT COUNT(*) FROM orders" };
  const original = "SELECT * FROM orders";

  assert.deepEqual(resolveQuerySuggestion(response, original, original), {
    query: response.query,
    previousQuery: original,
  });
  assert.equal(resolveQuerySuggestion(response, "", "").previousQuery, "");
  assert.equal(resolveQuerySuggestion(response, original, "SELECT * FROM users").previousQuery, null);
  assert.equal(resolveQuerySuggestion(response, original, "").previousQuery, null);

  for (const invalid of [null, {}, { query: null }, { query: 7 }, { query: " \n" }]) {
    assert.throws(() => resolveQuerySuggestion(invalid, original, original), /No query returned/);
  }
});
