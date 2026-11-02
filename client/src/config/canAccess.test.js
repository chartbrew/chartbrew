import assert from "node:assert/strict";
import test from "node:test";
import canAccess from "./canAccess.js";

for (const role of ["teamEditor", "teamViewer"]) {
  test(`${role} has the correct UI permissions without project assignments`, () => {
    const members = [{ user_id: 1, role, projects: [] }];
    assert.equal(canAccess("projectViewer", 1, members), true);
    assert.equal(canAccess("projectEditor", 1, members), role === "teamEditor");
    assert.equal(canAccess("teamEditor", 1, members), role === "teamEditor");
    assert.equal(canAccess("projectAdmin", 1, members), false);
    assert.equal(canAccess("teamAdmin", 1, members), false);
    assert.equal(canAccess("teamOwner", 1, members), false);
    assert.equal(canAccess("projectViewer", 2, members), false);
  });
}
