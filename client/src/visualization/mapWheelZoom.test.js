import assert from "node:assert/strict";
import test from "node:test";
import { addMapWheelZoom } from "./mapWheelZoom.js";

test("map wheel zoom is gradual, bounded, reversible and centered on the pointer", () => {
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
    const wheel = (deltaY, deltaMode = 0) => {
      listener({ deltaY, deltaMode, clientX: 200, clientY: 100, preventDefault() {}, stopPropagation() {} });
      return actions.at(-1);
    };
    const small = wheel(-1);
    assert.ok(small.zoom > 1 && small.zoom < 1.002);
    assert.equal(small.originX, 200);
    assert.equal(small.originY, 100);
    assert.equal(small[Object.keys(target)[0]], 0);
    assert.ok(wheel(-10000).zoom < 1.09);
    assert.equal(wheel(-80).zoom * wheel(80).zoom, 1);
    assert.equal(wheel(-1, 1).zoom, wheel(-16).zoom);
    assert.equal(wheel(-1, 2).zoom, wheel(-80).zoom);
    cleanup();
    assert.equal(listener, null);
  }
});
