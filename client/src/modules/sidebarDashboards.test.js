import assert from "node:assert/strict";
import test from "node:test";

import { getSidebarDashboards, readDashboardVisits } from "./sidebarDashboards.js";

test("sidebar uses accessible pins, then visits, then quick actions", () => {
  const projects = [1, 2, 3, 4].map((id) => ({ id, team_id: 10 }));
  projects.push({ id: 5, team_id: 11 }, { id: 6, team_id: 10, ghost: true });
  const visits = ["5", "6", "99", "3", "1", "4", "2"];
  const pins = [{ project_id: 5 }, { project_id: 6 }, { project_id: 2 }];
  const pinned = getSidebarDashboards(projects, pins, visits, 10);
  assert.equal(pinned.mode, "Pinned");
  assert.deepEqual(pinned.items.map(({ id }) => id), [2]);
  const recent = getSidebarDashboards(projects, pins.slice(0, 2), visits, 10);
  assert.equal(recent.mode, "Recent");
  assert.deepEqual(recent.items.map(({ id }) => id), [3, 1, 4]);
  assert.deepEqual(getSidebarDashboards(projects, [], [], 10).items, []);
  assert.equal(getSidebarDashboards(projects.slice(0, 3), [], visits, 10).mode, "Quick actions");
  assert.equal(getSidebarDashboards([], [], visits, 10).mode, "Quick actions");
  assert.equal(getSidebarDashboards(projects.slice(0, 1), [{ project_id: 1 }], [], 10).mode, "Pinned");
});

test("visit history tolerates missing, damaged, or unavailable browser storage", () => {
  const read = (value) => readDashboardVisits({ getItem: () => value }, "visits");
  assert.deepEqual(read(null), []);
  assert.deepEqual(read("{"), []);
  assert.deepEqual(read("{}"), []);
  assert.deepEqual(read('["3",3,null,"3","1"]'), ["3", "1"]);
  assert.equal(read(JSON.stringify(Array.from({ length: 25 }, (_, index) => `${index}`))).length, 20);
  assert.deepEqual(readDashboardVisits({ getItem: () => { throw new Error("Blocked"); } }, "visits"), []);
});
