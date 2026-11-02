import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { compact, moveElement } = require("react-grid-layout/build/utils");

test("repeated drag collisions keep charts packed and preserve their sizes", () => {
  for (const cols of [4, 12, 16]) {
    let layout = [
      { i: "above", x: 0, y: 0, w: cols, h: 2 },
      { i: "middle", x: 0, y: 2, w: Math.max(2, cols - 4), h: 3 },
      { i: "dragged", x: 0, y: 5, w: cols, h: 2 },
      { i: "below", x: 0, y: 7, w: cols, h: 2 },
    ];
    const sizes = layout.map(({ i, w, h }) => ({ i, w, h }));
    for (const y of [1, 1, 2, 1, 0, 1, 4, 5, 4, 1, 0, 0]) {
      layout = compact(moveElement(
        layout, layout.find((item) => item.i === "dragged"),
        0, y, true, false, "vertical", cols
      ), "vertical", cols);
      const ordered = [...layout].sort((a, b) => a.y - b.y);
      assert.equal(ordered[0].y, 0);
      ordered.slice(1).forEach((item, index) => {
        assert.equal(item.y, ordered[index].y + ordered[index].h);
      });
      assert.deepEqual(layout.map(({ i, w, h }) => ({ i, w, h })), sizes);
      assert.equal(Math.max(...layout.map((item) => item.y + item.h)), 9);
    }
    assert.equal([...layout].sort((a, b) => a.y - b.y)[0].i, "dragged");
  }
});
