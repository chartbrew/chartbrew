import { afterEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { Sequelize, DataTypes } from "sequelize";

const db = require("../../models/models");
const UserController = require("../../controllers/UserController");
const ChartController = require("../../controllers/ChartController");
const settings = require("../../settings-dev");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

function routeHandler(method, route) {
  const routes = new Map();
  const app = { settings };
  ["get", "post", "put", "delete"].forEach((verb) => {
    app[verb] = (path, ...handlers) => routes.set(`${verb} ${path}`, handlers);
  });
  require("../../api/UserRoute")(app);
  return routes.get(`${method} ${route}`).at(-1);
}

function response() {
  return { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
}

afterEach(() => {
  vi.restoreAllMocks();
  require("../../modules/socketManager").io = null;
});

describe("October advisory triage", () => {
  it("runs beforeValidate on static updates and uses literal login emails", async () => {
    const sequelize = new Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false });
    try {
      const User = require("../../models/models/user")(sequelize, DataTypes);
      await sequelize.sync();
      const password = await bcrypt.hash("test-password", 4);
      await User.create({ name: "Other", email: "johnXdoe@example.com", password });
      const user = await User.create({ name: "User", email: "john_doe@example.com", password });
      await User.update({ admin: true }, { where: { id: user.id } });
      expect((await user.reload()).admin).toBe(false);
      vi.spyOn(db.User, "findOne").mockImplementation((options) => User.findOne(options));
      vi.spyOn(db.User2fa, "findOne").mockResolvedValue(null);
      const controller = new UserController();
      expect((await controller.login(user.email, "test-password")).id).toBe(user.id);
      await expect(controller.login("%", "test-password")).rejects.toThrow("401");
      await expect(controller.login([user.email], "test-password")).rejects.toThrow("401");
    } finally {
      await sequelize.close();
    }
  });

  it("scopes pin deletion to the authenticated user", async () => {
    const destroy = vi.spyOn(db.PinnedDashboard, "destroy").mockResolvedValue(0);
    await routeHandler("delete", "/user/:id/pin/:pin_id")({
      params: { id: "2", pin_id: "victim-pin" }, user: { id: 1 },
    }, response());
    expect(destroy).toHaveBeenCalledWith({ where: { id: "victim-pin", user_id: 1 } });
  });

  it("rejects pins for foreign and missing projects", async () => {
    const project = vi.spyOn(db.Project, "findByPk").mockResolvedValue({ id: 5, team_id: 2 });
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue(null);
    const create = vi.spyOn(db.PinnedDashboard, "create").mockResolvedValue({});
    const controller = new UserController();
    await expect(controller.pinDashboard(5, 1)).rejects.toThrow("403");
    project.mockResolvedValue(null);
    await expect(controller.pinDashboard(5, 1)).rejects.toThrow("403");
    expect(create).not.toHaveBeenCalled();
  });

  it.each(["teamOwner", "teamAdmin", "projectViewer"])("allows an accessible project pin as %s", async (role) => {
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({ id: 5, team_id: 2 });
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role, projects: [5] });
    vi.spyOn(db.PinnedDashboard, "create").mockResolvedValue({ id: "own-pin" });
    await expect(new UserController().pinDashboard(5, 1)).resolves.toEqual({ id: "own-pin" });
  });

  it("does not expose private pins in team member lists", async () => {
    const find = vi.spyOn(db.User, "findAll").mockResolvedValue([]);
    await new UserController().getUsersById([1, 2], 5);
    expect(find.mock.calls[0][0].include.some((entry) => entry.model === db.PinnedDashboard)).toBe(false);
  });

  it.each([{}, { autoUpdate: 0 }, { autoUpdate: 60 }])("does not mutate nested resources through chart updates: %j", async (branch) => {
    const controller = new ChartController();
    vi.spyOn(db.Chart, "update").mockResolvedValue([1]);
    vi.spyOn(db.ChartDatasetConfig, "findAll").mockResolvedValue([]);
    vi.spyOn(controller, "findById").mockResolvedValue({ id: 1 });
    vi.spyOn(controller, "syncLegacyVisualization").mockResolvedValue({ id: 1 });
    const writes = [
      vi.spyOn(controller.datasetController, "update").mockResolvedValue({}),
      vi.spyOn(controller.datasetController, "remove").mockResolvedValue({}),
      vi.spyOn(controller.datasetController, "create").mockResolvedValue({}),
      vi.spyOn(controller.dataRequestController, "update").mockResolvedValue({}),
    ];
    const nested = [{ id: 99, chart_id: 1, name: "Changed" }, { id: 100, deleted: true }];
    await controller.update(1, {
      ...branch, ChartDatasetConfigs: nested, ChartDatasets: nested,
      dataRequests: [{ id: 101, route: "/changed" }],
      dataRequest: { id: 101, route: "/changed" },
    });
    for (const write of writes) expect(write).not.toHaveBeenCalled();
  });

  it.each(["missing", "mail"])("keeps the process alive after password reset failure: %s", (failure) => {
    const result = spawnSync(process.execPath, ["--unhandled-rejections=strict", "-e", `
      const UserController = require("./controllers/UserController");
      const db = require("./models/models");
      db.User.findOne = async () => (${failure === "missing" ? "null" : '{ id: 1, email: "user@example.com" }'});
      UserController.prototype.update = async () => ({ id: 1, email: "user@example.com" });
      require("./modules/mail").passwordReset = async () => { throw new Error("Mail unavailable"); };
      const app = { settings: require("./settings-dev") };
      for (const verb of ["get", "post", "put", "delete"]) {
        app[verb] = (path, ...handlers) => {
          if (verb === "post" && path === "/user/password/reset") app.reset = handlers.at(-1);
        };
      }
      require("./api/UserRoute")(app);
      const res = { status() { return this; }, send() { return this; } };
      app.reset({ body: { email: "missing@example.com" } }, res);
      setImmediate(() => process.exit(0));
    `], { cwd: process.cwd(), encoding: "utf8" });
    expect(result.status).toBe(0);
  });

  it("rejects traversal tokens before browser or filesystem operations", async () => {
    const { chromium } = require("playwright");
    const launch = vi.spyOn(chromium, "launch").mockRejectedValue(new Error("Browser must not start"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(require("../../modules/snapshots").snapChart("x/../../../../chart/42")).resolves.toBeNull();
    expect(launch).not.toHaveBeenCalled();
    await expect(db.Chart.build({ project_id: 1, snapshotToken: "x/../../../../chart/42" }).validate()).rejects.toThrow("Validation isUUID on snapshotToken failed");
  });

  it("keeps profile updates from replacing credentials or restoring old sessions", async () => {
    const update = vi.spyOn(UserController.prototype, "update").mockResolvedValue({ id: 1 });
    await routeHandler("put", "/user/:id")({ params: { id: "1" }, body: {
      name: "Updated", admin: true, password: "hash", passwordResetToken: "reset",
      sessionVersion: 0, email: "other@example.com",
    } }, response());
    expect(update).toHaveBeenCalledWith("1", { name: "Updated" });
  });

  it("preserves UUID snapshot tokens from both database migrations and new charts", async () => {
    for (const snapshotToken of ["123e4567-e89b-12d3-a456-426614174000", "123e4567-e89b-42d3-a456-426614174000"]) {
      await expect(db.Chart.build({ project_id: 1, snapshotToken }).validate()).resolves.toBeDefined();
    }
  });

  it("denies a project pin when a team member has no access to that project", async () => {
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({ id: 5, team_id: 2 });
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role: "projectViewer", projects: [6] });
    await expect(new UserController().pinDashboard(5, 1)).rejects.toThrow("403");
  });

  it("revokes old sessions after a password reset and accepts a new login", async () => {
    const user = { id: 1, email: "user@example.com", password: await bcrypt.hash("old-password", 4), sessionVersion: 0 };
    const token = jwt.sign({ id: user.id }, settings.encryptionKey);
    vi.spyOn(db.TokenBlacklist, "findOne").mockResolvedValue(null);
    vi.spyOn(db.User, "findOne").mockImplementation(async () => user);
    vi.spyOn(db.User, "findByPk").mockImplementation(async () => user);
    vi.spyOn(db.User, "update").mockImplementation(async (data) => {
      user.password = data.password;
      if (data.sessionVersion) user.sessionVersion += 1;
      return [1];
    });
    const req = { headers: { authorization: `Bearer ${token}` }, params: { id: "1" } };
    const verifyToken = require("../../modules/verifyToken");
    const verifyUser = require("../../modules/verifyUser");
    const next = vi.fn();
    await verifyToken(req, response(), next);
    expect(next).toHaveBeenCalledOnce();
    const socketManager = require("../../modules/socketManager");
    const disconnectSockets = vi.fn();
    const room = vi.fn().mockReturnValue({ disconnectSockets });
    socketManager.io = { in: room };
    await new UserController().changePassword({ token: `reset.${Date.now() + 60000}`, password: "new-password" });
    expect(room).toHaveBeenCalledWith("user:1");
    expect(disconnectSockets).toHaveBeenCalledWith(true);
    for (const verify of [verifyToken, verifyUser]) {
      const res = response();
      next.mockClear();
      await verify(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    }
    await expect(socketManager.authenticateToken(token)).rejects.toThrow("Unauthorized");
    const optionalRequest = { headers: req.headers };
    await require("../../modules/getUserFromToken")(optionalRequest, response(), vi.fn());
    expect(optionalRequest.user).toBeUndefined();
    vi.spyOn(db.User2fa, "findOne").mockResolvedValue(null);
    const res = response();
    await routeHandler("post", "/user/login")({ body: { email: user.email, password: "new-password" } }, res);
    await new Promise((resolve) => setImmediate(resolve));
    const newToken = res.send.mock.calls[0][0].token;
    next.mockClear();
    await verifyToken({ headers: { authorization: `Bearer ${newToken}` } }, response(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});
