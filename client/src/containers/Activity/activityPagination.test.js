import assert from "node:assert/strict";
import { test } from "node:test";

import { ACTIVITY_PAGE_SIZE, getActivityPage } from "./activityPagination.js";

test("activity pages cover every item and recover when the last row is removed", () => {
  const rows = Array.from({ length: 51 }, (_, id) => id);
  const visited = [];
  for (let page = 1; page <= getActivityPage(1, rows.length).totalPages; page += 1) {
    const { start } = getActivityPage(page, rows.length);
    visited.push(...rows.slice(start, start + ACTIVITY_PAGE_SIZE));
  }
  assert.deepEqual(visited, rows);
  assert.deepEqual(getActivityPage(6, 50), { page: 5, start: 40, totalPages: 5 });
  assert.deepEqual(getActivityPage(5, 0), { page: 1, start: 0, totalPages: 1 });
  assert.deepEqual(getActivityPage(0, 11), { page: 1, start: 0, totalPages: 2 });
});
