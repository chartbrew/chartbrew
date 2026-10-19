import assert from "node:assert/strict";
import test from "node:test";

import {
  CHARTBREW_V6_WELCOME_CUTOFF,
  CHARTBREW_V6_WELCOME_TUTORIAL,
  shouldShowChartbrewV6Welcome,
} from "./chartbrewV6Welcome.js";

const user = { id: 7, createdAt: "2025-01-01T00:00:00Z" };
const teamWithRole = (role, userId = 7) => ({ id: 1, TeamRoles: [{ user_id: userId, role }] });

test("shows only for the current user's team-level roles", () => {
  for (const role of ["teamOwner", "teamAdmin", "teamEditor", "teamViewer"]) {
    assert.equal(shouldShowChartbrewV6Welcome(user, teamWithRole(role)), true);
    assert.equal(shouldShowChartbrewV6Welcome(user, teamWithRole(role, 8)), false);
  }
  for (const role of ["projectAdmin", "projectEditor", "projectViewer", "unknown"]) {
    assert.equal(shouldShowChartbrewV6Welcome(user, teamWithRole(role)), false);
  }
});

test("requires loaded data, a valid date before the cutoff, and an unseen tour", () => {
  const team = teamWithRole("teamOwner");
  assert.equal(shouldShowChartbrewV6Welcome(null, team), false);
  assert.equal(shouldShowChartbrewV6Welcome(user, null), false);
  assert.equal(shouldShowChartbrewV6Welcome(user, { id: 1 }), false);
  for (const createdAt of [undefined, "invalid", CHARTBREW_V6_WELCOME_CUTOFF, "2027-01-01"]) {
    assert.equal(shouldShowChartbrewV6Welcome({ ...user, createdAt }, team), false);
  }
  const createdAt = new Date(Date.parse(CHARTBREW_V6_WELCOME_CUTOFF) - 1).toISOString();
  assert.equal(shouldShowChartbrewV6Welcome({ ...user, createdAt }, team), true);
  assert.equal(shouldShowChartbrewV6Welcome({ ...user, tutorials: { [CHARTBREW_V6_WELCOME_TUTORIAL]: true } }, team), false);
  assert.equal(shouldShowChartbrewV6Welcome({ ...user, tutorials: { chartbrewV5Welcome: true } }, team), true);
});
