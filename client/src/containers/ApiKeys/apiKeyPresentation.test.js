import assert from "node:assert/strict";
import test from "node:test";

import {
  getPermissionLabels,
  getProjectAccessLabel,
  isLegacyApiKey,
} from "./apiKeyPresentation.js";

test("marks old API keys as unavailable for the Data API", () => {
  const key = { dataApiAccess: "unavailable" };

  assert.equal(isLegacyApiKey(key), true);
  assert.deepEqual(getPermissionLabels(key), []);
  assert.equal(getProjectAccessLabel(key), "Existing integrations only");
});

test("shows scoped key permissions and selected projects", () => {
  const key = {
    dataApiAccess: "ready",
    permissions: ["data:read", "data:refresh"],
    projectAccess: { allProjects: false, projectIds: [2, 3] },
  };

  assert.deepEqual(getPermissionLabels(key), ["Read data", "Refresh data"]);
  assert.equal(getProjectAccessLabel(key, [
    { id: 1, name: "One" },
    { id: 2, name: "Two" },
    { id: 3, name: "Three" },
  ]), "2 projects");
});

test("states that an all-project key is limited to its team", () => {
  assert.equal(getProjectAccessLabel({
    dataApiAccess: "ready",
    projectAccess: { allProjects: true, projectIds: [] },
  }), "All projects in this team");
});

test("shows the two explicit MCP write permissions", () => {
  assert.deepEqual(getPermissionLabels({ dataApiAccess: "ready", permissions: ["charts:preview", "datasets:write"] }),
    ["Read data", "Create chart previews", "Create datasets"]);
});
