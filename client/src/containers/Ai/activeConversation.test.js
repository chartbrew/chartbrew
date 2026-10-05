import assert from "node:assert/strict";
import test from "node:test";
import reducer, {
  dismissAiConversation, hideAiModal, setActiveAiConversation, setInlineAiConversationKey,
  clearInlineAiConversationKey, showAiModal, toggleAiModal, updateActiveAiConversation,
} from "../../slices/ui.js";
import { getStudioConversationPath, isActiveConversationFor, isConversationBarHiddenOnRoute, readActiveConversation, writeActiveConversation } from "./activeConversation.js";

test("the conversation bar stays hidden on settings and public pages", () => {
  for (const pathname of ["/settings", "/settings/", "/settings/profile", "/settings/team/ai", "/login", "/report/example", "/chart/1/embedded"]) {
    assert.equal(isConversationBarHiddenOnRoute(pathname), true, pathname);
  }
  for (const pathname of ["/", "/dashboards", "/dashboard/1", "/dashboard/1/settings", "/settings-example"]) {
    assert.equal(isConversationBarHiddenOnRoute(pathname), false, pathname);
  }
});

test("navigation and dismissal keep saved history but reject late updates from older requests", () => {
  let state = reducer(undefined, setActiveAiConversation({ key: "first", id: "saved", userId: 1, teamId: 2, studio_chart_id: null }));
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

test("studio chats keep request tracking but do not reopen the modal or persist the bottom bar", () => {
  const entries = new Map();
  const storage = { getItem: (key) => entries.get(key), setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key) };
  writeActiveConversation(1, 2, { id: "old-studio" }, storage);
  const chat = { key: "studio", id: "saved", userId: 1, teamId: 2, studio_chart_id: 42, busy: true };
  let state = reducer(undefined, setActiveAiConversation(chat));
  state = reducer(state, showAiModal());
  assert.equal(state.aiModalConversationId, null);
  assert.equal(state.activeAiConversation.busy, true);
  state = reducer(state, updateActiveAiConversation({ key: "studio", busy: false }));
  state = reducer(state, hideAiModal());
  state = reducer(state, toggleAiModal());
  assert.equal(state.aiModalConversationId, null);
  writeActiveConversation(1, 2, state.activeAiConversation, storage);
  assert.equal(readActiveConversation(1, 2, storage), null);
  state = reducer(state, showAiModal({ conversationId: "explicit" }));
  assert.equal(state.aiModalConversationId, "explicit");
});

test("studio navigation requires an authorized destination and preserves the conversation ID", () => {
  const conversation = { id: "saved", studio_chart_id: 42, studioChart: { id: 42, project_id: 9 } };
  assert.equal(getStudioConversationPath(conversation), "/dashboard/9/chart/42/edit?conversation=saved");
  assert.equal(getStudioConversationPath({ ...conversation, studioChart: null }), null);
  assert.equal(getStudioConversationPath({ ...conversation, studio_chart_id: null }), null);
});

test("a restored conversation cannot redirect the modal before its chart link is checked", () => {
  let state = reducer(undefined, setActiveAiConversation({ key: "restored", id: "saved" }));
  state = reducer(state, showAiModal());
  assert.equal(state.aiModalConversationId, null);
  state = reducer(state, updateActiveAiConversation({ key: "restored", studio_chart_id: null }));
  state = reducer(state, showAiModal());
  assert.equal(state.aiModalConversationId, "saved");
});
