import { createRequire } from "module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  buildDataApiAccess,
  getEffectiveProjectIds,
  normalizeProjectIds,
  normalizeScopes,
  validateKeyProjectIds,
} = require("../../modules/dataApiAccess.js");

describe("dataApiAccess", () => {
  it.each(["teamOwner", "teamAdmin"])("limits %s access with the key project list", (role) => {
    expect(getEffectiveProjectIds({
      role,
      teamProjectIds: [1, 2, 3],
      keyProjectIds: [2, 3],
    })).toEqual([2, 3]);
  });

  it.each(["projectAdmin", "projectEditor", "projectViewer"])(
    "intersects %s role projects with key projects",
    (role) => {
      expect(getEffectiveProjectIds({
        role,
        roleProjectIds: [1, 2],
        teamProjectIds: [1, 2, 3],
        keyProjectIds: [2, 3],
      })).toEqual([2]);
    }
  );

  it("uses the current role projects for an all-project key", () => {
    expect(getEffectiveProjectIds({
      role: "projectViewer",
      roleProjectIds: [1, 3],
      teamProjectIds: [1, 2, 3],
      keyProjectIds: [],
      allProjects: true,
    })).toEqual([1, 3]);
  });

  it("returns no projects for an unknown or removed role", () => {
    expect(getEffectiveProjectIds({
      role: "unknown",
      teamProjectIds: [1, 2],
      keyProjectIds: [1, 2],
    })).toEqual([]);
  });

  it("normalizes project IDs and accepted scopes", () => {
    expect(normalizeProjectIds([2, "2", -1, "bad", 3])).toEqual([2, 3]);
    expect(normalizeScopes(["data:read", "unknown", "data:read"])).toEqual(["data:read"]);
  });

  it("requires positive integer project IDs during key creation", async () => {
    const db = { Project: { count: async () => 2 } };

    await expect(validateKeyProjectIds(db, 1, [1, 2])).resolves.toBe(true);
    await expect(validateKeyProjectIds(db, 1, [1, "2"])).resolves.toBe(false);
    await expect(validateKeyProjectIds(db, 1, [true])).resolves.toBe(false);
  });

  it("does not load every team project for project-scoped roles", async () => {
    let projectQueries = 0;
    const db = {
      Project: {
        findAll: async () => {
          projectQueries += 1;
          return [{ id: 2 }];
        },
      },
    };

    const projectAccess = await buildDataApiAccess(db, {
      id: "key",
      team_id: 1,
      user_id: 2,
      scopes: ["data:read"],
      project_ids: [2],
      all_projects: true,
    }, {
      role: "projectViewer",
      projects: [2],
    });
    expect(projectAccess.projectIds).toEqual([2]);
    expect(projectQueries).toBe(0);

    const teamAccess = await buildDataApiAccess(db, {
      id: "key",
      team_id: 1,
      user_id: 2,
      scopes: ["data:read"],
      project_ids: [2],
      all_projects: false,
    }, {
      role: "teamAdmin",
      projects: [],
    });
    expect(teamAccess.projectIds).toEqual([2]);
    expect(projectQueries).toBe(1);
  });
});
