import {
  afterEach, describe, expect, it, vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const db = require("../../models/models");
const ProjectController = require("../../controllers/ProjectController.js");
const TeamController = require("../../controllers/TeamController.js");

function createRouteRegistry() {
  const routes = new Map();
  const register = (method, path, handlers) => routes.set(`${method} ${path}`, handlers);

  return {
    app: {
      delete: (path, ...handlers) => register("DELETE", path, handlers),
      get: (path, ...handlers) => register("GET", path, handlers),
      post: (path, ...handlers) => register("POST", path, handlers),
      put: (path, ...handlers) => register("PUT", path, handlers),
    },
    getHandlers: (method, path) => routes.get(`${method} ${path}`) || [],
  };
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function getProjectPermissionHandler(method, path) {
  const registry = createRouteRegistry();
  const projectRoute = require("../../api/ProjectRoute.js");
  projectRoute(registry.app);
  return registry.getHandlers(method, path)[1];
}

describe("project tenant authorization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("authorizes project routes against the persisted project team, not body team_id", async () => {
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({ id: 42, team_id: 200 });
    const getTeamRole = vi.spyOn(TeamController.prototype, "getTeamRole")
      .mockResolvedValue(null);
    const permissionHandler = getProjectPermissionHandler("PUT", "/project/:id");
    const response = createResponse();
    const next = vi.fn();

    await permissionHandler({
      body: { team_id: 100 },
      params: { id: "42" },
      user: { id: 7 },
    }, response, next);

    expect(getTeamRole).toHaveBeenCalledWith(200, 7);
    expect(response.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("continues using body team_id when authorizing project creation", async () => {
    const getTeamRole = vi.spyOn(TeamController.prototype, "getTeamRole")
      .mockResolvedValue({ role: "teamOwner" });
    const permissionHandler = getProjectPermissionHandler("POST", "/project");
    const response = createResponse();
    const next = vi.fn();

    await permissionHandler({
      body: { team_id: 100 },
      params: {},
      user: { id: 7 },
    }, response, next);

    expect(getTeamRole).toHaveBeenCalledWith(100, 7);
    expect(next).toHaveBeenCalledOnce();
  });

  it("drops immutable and unknown fields from ordinary project updates", async () => {
    const controller = new ProjectController();
    vi.spyOn(controller, "findById").mockResolvedValue({ id: 42, team_id: 100 });
    const update = vi.spyOn(db.Project, "update").mockResolvedValue([1]);

    await controller.update(42, {
      name: "Updated dashboard",
      team_id: 200,
      id: 99,
      unknown: "ignored",
    });

    expect(update).toHaveBeenCalledWith(
      { name: "Updated dashboard" },
      { where: { id: 42 } }
    );
  });

  it("binds nested variable updates to their route project", async () => {
    const controller = new ProjectController();
    const update = vi.spyOn(db.Variable, "update").mockResolvedValue([0]);

    const result = await controller.updateVariable(42, "variable-id", {
      name: "Updated variable",
      project_id: 99,
    });

    expect(update).toHaveBeenCalledWith(
      { name: "Updated variable" },
      { where: { id: "variable-id", project_id: 42 } }
    );
    expect(result).toBeNull();
  });
});
