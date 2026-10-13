import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { transformWithOxc } from "vite";

async function setup() {
  const state = [];
  let cursor = 0;
  let effect;
  let dependencies;
  let cleanup;
  let projectId = "1";
  const requests = [];
  const dispatch = (action) => {
    if (action.type === "changeActiveProject") return action;
    const deferred = Promise.withResolvers();
    const request = {
      ...action,
      ...deferred,
      aborted: false,
      unwrap: () => deferred.promise,
      abort: () => { request.aborted = true; deferred.reject(new Error("Aborted")); },
    };
    requests.push(request);
    return request;
  };
  const action = (type) => (arg) => ({ type, arg });
  const modules = {
    react: {
      default: React,
      useState: (initial) => {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (value) => {
          state[index] = typeof value === "function" ? value(state[index]) : value;
        }];
      },
      useEffect: (callback, next) => {
        if (!dependencies || next.some((value, index) => value !== dependencies[index])) {
          effect = callback;
          dependencies = next;
        }
      },
    },
    "react-redux": { useDispatch: () => dispatch, useSelector: () => ({ id: 10 }) },
    "react-router": { Outlet: "outlet", useParams: () => ({ projectId }) },
    "@heroui/react": {
      Alert: Object.assign(() => null, { Indicator: "indicator", Content: "content", Title: "title", Description: "description" }),
      Button: "button",
    },
    "../../slices/project": Object.fromEntries(["getProject", "getProjects", "changeActiveProject"].map((name) => [name, action(name)])),
    "../../slices/team": { ...Object.fromEntries(["getTeam", "getTeamMembers"].map((name) => [name, action(name)])), selectTeam: () => {} },
    "../../slices/chart": { getProjectCharts: action("getProjectCharts") },
    "../../components/LoadingScreen": { default: "loader" },
  };
  const context = vm.createContext({ window: { localStorage: { setItem() {} } } });
  const source = await readFile(new URL("./ProjectBoard.jsx", import.meta.url), "utf8");
  const { code } = await transformWithOxc(source, "ProjectBoard.jsx", { jsx: { runtime: "classic" } });
  const mod = new vm.SourceTextModule(code, { context });
  await mod.link((name) => new vm.SyntheticModule(Object.keys(modules[name]), function() {
    Object.entries(modules[name]).forEach(([key, value]) => this.setExport(key, value));
  }, { context }));
  await mod.evaluate();

  return {
    requests,
    render: () => { cursor = 0; return mod.namespace.default(); },
    commit: () => {
      if (effect) {
        cleanup?.();
        cleanup = effect();
        effect = null;
      }
    },
    navigate: (id) => { projectId = id; },
    cleanup: () => cleanup?.(),
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("dashboard shows a loader before effects and until charts and project are ready", async () => {
  const app = await setup();
  assert.equal(app.render().type, "loader");
  app.commit();
  for (const request of app.requests) {
    if (request.type !== "getProjectCharts") request.resolve({});
  }
  await flush();
  assert.equal(app.render().type, "loader");
  app.requests.find(({ type }) => type === "getProjectCharts").resolve([]);
  await flush();
  assert.equal(app.render().type, "loader");
  app.requests.find(({ type }) => type === "getProject").resolve({ id: 1 });
  await flush();
  assert.equal(app.render().props.children.type, "outlet");
  app.cleanup();
});

test("failed requests show a retry action instead of a permanent loader", async () => {
  const app = await setup();
  app.render();
  app.commit();
  app.requests[0].reject(new Error("Offline"));
  await flush();
  const error = app.render();
  assert.equal(error.props.status, "danger");
  error.props.children.find((child) => child.type === "button").props.onPress();
  assert.equal(app.render().type, "loader");
  app.commit();
  assert.ok(app.requests.slice(0, 4).every(({ aborted }) => aborted));
  assert.equal(app.requests.length, 8);
  app.cleanup();
  await flush();
});

test("navigation aborts old requests and does not show the previous dashboard", async () => {
  const app = await setup();
  app.render();
  app.commit();
  app.requests.forEach((request) => request.resolve({}));
  await flush();
  const oldProject = app.requests.find(({ type }) => type === "getProject");
  app.navigate("2");
  assert.equal(app.render().type, "loader");
  app.commit();
  assert.equal(oldProject.aborted, true);
  oldProject.resolve({ id: 1 });
  await flush();
  assert.equal(app.render().type, "loader");
  app.requests.filter(({ aborted }) => !aborted).forEach((request) => request.resolve([]));
  await flush();
  app.requests.find(({ type, arg }) => type === "getProject" && arg.project_id === "2").resolve({ id: 2 });
  await flush();
  assert.equal(app.render().props.children.type, "outlet");
  app.navigate("1");
  assert.equal(app.render().type, "loader");
  app.cleanup();
});
