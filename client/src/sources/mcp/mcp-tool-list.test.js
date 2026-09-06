import assert from "node:assert/strict";
import test from "node:test";

import { getMcpToolPage } from "./mcp-tool-list.js";

test("tool pages cover the full list without changing tools or approvals", () => {
  const tools = Array.from({ length: 250 }, (_, id) => ({ name: `tool_${id}` }));
  const pages = Array.from({ length: 25 }, (_, index) => getMcpToolPage(tools, { page: index + 1 }));
  assert.ok(pages.every((page) => page.tools.length === 10 && page.totalPages === 25));
  assert.deepEqual(pages.flatMap((page) => page.tools), tools);
  assert.equal(pages[24].start, 241);
  assert.equal(pages[24].end, 250);
  assert.equal(pages[0].tools[0], tools[0]);
  assert.equal(getMcpToolPage(tools, { page: 99 }).page, 25);
  assert.equal(getMcpToolPage(tools, { page: 0 }).page, 1);
});

test("search and hints apply to all tools before pagination, including empty and short pages", () => {
  const tools = Array.from({ length: 23 }, (_, id) => ({ name: `tool_${id}` }));
  tools[22] = { name: "visits", title: "Country breakdown", description: "Website traffic", annotations: { readOnlyHint: true } };
  assert.equal(getMcpToolPage(tools, { page: 3 }).tools.length, 3);
  for (const search of ["visits", " COUNTRY ", "traffic"]) {
    const result = getMcpToolPage(tools, { search, page: 3, hintFilter: "readOnlyHint" });
    assert.deepEqual(result.tools, [tools[22]]);
    assert.equal(result.page, 1);
  }
  assert.equal(getMcpToolPage(tools, { hintFilter: "unmarked" }).total, 22);
  assert.equal(getMcpToolPage(tools, { hintFilter: "destructiveHint" }).total, 0);
  for (const result of [getMcpToolPage([]), getMcpToolPage(tools, { search: "no match", page: 3 })]) {
    assert.deepEqual(result, { tools: [], page: 1, totalPages: 1, total: 0, start: 0, end: 0 });
  }
});
