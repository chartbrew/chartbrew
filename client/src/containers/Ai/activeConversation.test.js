import assert from "node:assert/strict";
import test from "node:test";
import reducer, {
  dismissAiConversation, hideAiModal, setActiveAiConversation, setInlineAiConversationKey,
  clearInlineAiConversationKey, showAiModal, updateActiveAiConversation,
} from "../../slices/ui.js";
import { isActiveConversationFor, readActiveConversation, writeActiveConversation } from "./activeConversation.js";

test("navigation and dismissal keep saved history but reject late updates from older requests", () => {
  let state = reducer(undefined, setActiveAiConversation({ key: "first", id: "saved", userId: 1, teamId: 2 }));
  state = reducer(state, showAiModal());
  assert.equal(state.aiModalConversationId, "saved");
  state = reducer(state, hideAiModal());
  assert.equal(state.activeAiConversation.id, "saved");
  state = reducer(state, setActiveAiConversation({ key: "second", busy: true }));
  state = reducer(state, updateActiveAiConversation({ key: "first", id: "wrong" }));
  assert.equal(state.activeAiConversation.key, "second");
  state = reducer(state, updateActiveAiConversation({ key: "second", id: "new-saved", busy: false }));
  assert.equal(state.activeAiConversation.id, "new-saved");
  state = reducer(state, dismissAiConversation("first"));
  assert.ok(state.activeAiConversation);
  state = reducer(state, dismissAiConversation("second"));
  state = reducer(state, updateActiveAiConversation({ key: "second", id: "new-saved" }));
  assert.equal(state.activeAiConversation, null);
  state = reducer(state, setInlineAiConversationKey("new"));
  state = reducer(state, clearInlineAiConversationKey("old"));
  assert.equal(state.inlineAiConversationKey, "new");
  state = reducer(state, clearInlineAiConversationKey("new"));
  assert.equal(state.inlineAiConversationKey, null);
});

test("refresh remembers only an ID, with separate references for each account and team", () => {
  const entries = new Map();
  const storage = { getItem: (key) => entries.get(key), setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key) };
  writeActiveConversation(1, 2, { id: "saved", title: "Private title", messages: ["Private data"] }, storage);
  assert.deepEqual([...entries.values()], ["saved"]);
  const restored = readActiveConversation(1, 2, storage);
  assert.equal(restored.id, "saved");
  assert.equal(isActiveConversationFor(restored, "1", "2"), true);
  assert.equal(isActiveConversationFor(restored, 3, 2), false);
  assert.equal(isActiveConversationFor(restored, 1, 3), false);
  assert.equal(readActiveConversation(3, 2, storage), null);
  assert.equal(readActiveConversation(1, 3, storage), null);
  writeActiveConversation(1, 2, null, storage);
  assert.equal(readActiveConversation(1, 2, storage), null);
  const blocked = { getItem: () => { throw Error("Blocked"); }, setItem: () => { throw Error("Blocked"); } };
  assert.equal(readActiveConversation(1, 2, blocked), null);
  assert.doesNotThrow(() => writeActiveConversation(1, 2, { id: "saved" }, blocked));
});
