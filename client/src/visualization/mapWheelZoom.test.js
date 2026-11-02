import assert from "node:assert/strict";
import test from "node:test";
import { addMapWheelZoom } from "./mapWheelZoom.js";

test("map wheel zoom needs Cmd or Ctrl and stays gradual, bounded and pointer-centered", () => {
  let listener;
  const actions = [];
  const container = {
    clientWidth: 800,
    clientHeight: 400,
    getBoundingClientRect: () => ({ left: 100, top: 50, width: 400, height: 200 }),
    addEventListener: (name, callback, options) => {
      assert.equal(name, "wheel");
      assert.deepEqual(options, { capture: true, passive: false });
      listener = callback;
    },
    removeEventListener: (name, callback) => {
      assert.equal(callback, listener);
      listener = null;
    },
  };
  for (const target of [{ geoIndex: 0 }, { seriesIndex: 0 }]) {
    const cleanup = addMapWheelZoom(container, { dispatchAction: (action) => actions.push(action) }, target);
    const wheel = (deltaY, deltaMode = 0, modifier = "metaKey") => {
      let prevented = false;
      let stopped = false;
      listener({
        deltaY, deltaMode, [modifier]: true, clientX: 200, clientY: 100,
        preventDefault() { prevented = true; },
        stopPropagation() { stopped = true; },
      });
      assert.equal(prevented, true);
      assert.equal(stopped, true);
      return actions.at(-1);
    };
    const previousActions = actions.length;
    let prevented = false;
    let stopped = false;
    listener({
      deltaY: -80, clientX: 200, clientY: 100,
      preventDefault() { prevented = true; },
      stopPropagation() { stopped = true; },
    });
    assert.equal(prevented, false);
    assert.equal(stopped, false);
    assert.equal(actions.length, previousActions);
    const small = wheel(-1);
    assert.ok(small.zoom > 1 && small.zoom < 1.002);
    assert.equal(small.originX, 200);
    assert.equal(small.originY, 100);
    assert.equal(small[Object.keys(target)[0]], 0);
    assert.ok(wheel(-10000).zoom < 1.09);
    assert.equal(wheel(-80).zoom * wheel(80).zoom, 1);
    assert.equal(wheel(-1, 1).zoom, wheel(-16).zoom);
    assert.equal(wheel(-1, 2).zoom, wheel(-80).zoom);
    assert.ok(wheel(-1, 0, "ctrlKey").zoom > 1);
    cleanup();
    assert.equal(listener, null);
  }
});
