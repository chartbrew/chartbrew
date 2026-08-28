import assert from "node:assert/strict";
import test from "node:test";

import { getLinePause, getTypeDelay } from "./typewriter.js";

function sequence(values) {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

test("letter delays jump instead of staying even", () => {
  const slow = getTypeDelay("e", sequence([0.95, 0.2]));
  const fast = getTypeDelay("e", sequence([0.05, 0.2]));
  assert.ok(slow > fast + 20);
});

test("punctuation waits longer than a letter", () => {
  const letter = getTypeDelay("e", () => 0.4);
  const comma = getTypeDelay(",", () => 0.4);
  const period = getTypeDelay(".", () => 0.4);
  assert.ok(comma > letter);
  assert.ok(period > letter);
});

test("occasional stutters add extra wait", () => {
  const steady = getTypeDelay("a", sequence([0.3, 0.9]));
  const stutter = getTypeDelay("a", sequence([0.3, 0.05, 0.5]));
  assert.ok(stutter > steady + 30);
});

test("the pause between title and subtitle is longer than a keystroke", () => {
  const key = getTypeDelay("a", () => 0.2);
  const pause = getLinePause(() => 0.2);
  assert.ok(pause > key * 2);
});
