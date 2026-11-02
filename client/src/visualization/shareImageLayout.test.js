import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { resolveImageLayout } from "./shareImageLayout.js";

const require = createRequire(import.meta.url);
const { resolveImageLayout: resolveServerImageLayout } = require(
  "../../../shared/visualization/imageLayout.js"
);

const content = {
  branding: "chartbrew",
  companyName: true,
  dashboardName: true,
  logo: false,
  subtitle: { show: true, text: "Context" },
  title: { show: true, text: "Title" },
};

test("client image layout stays aligned with the server layout", () => {
  [
    { height: 720, width: 1280 },
    { height: 2340, width: 1080 },
    { height: 600, width: 800 },
  ].forEach((dimensions) => {
    const input = { ...dimensions, content, layout: "shareCard" };
    assert.deepEqual(resolveImageLayout(input), resolveServerImageLayout(input));
  });
});
