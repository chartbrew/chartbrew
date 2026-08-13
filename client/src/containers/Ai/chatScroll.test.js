import assert from "node:assert/strict";
import test from "node:test";

import {
  getRemainingScrollDistance,
  isChatPinned,
  scrollChatToBottom,
} from "./chatScroll.js";

test("keeps a chat pinned after asynchronous content growth", () => {
  const container = { clientHeight: 400, scrollHeight: 420, scrollTop: 20 };
  assert.equal(isChatPinned(container), true);
  container.scrollHeight = 780;
  scrollChatToBottom(container);
  assert.equal(container.scrollTop, 780);
  assert.equal(getRemainingScrollDistance(container), 0);
});

test("does not treat a user reading older messages as pinned", () => {
  const container = { clientHeight: 400, scrollHeight: 900, scrollTop: 200 };
  assert.equal(getRemainingScrollDistance(container), 300);
  assert.equal(isChatPinned(container), false);
});
