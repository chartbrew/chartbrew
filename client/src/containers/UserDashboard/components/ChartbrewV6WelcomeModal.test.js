import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { transformWithOxc } from "vite";

import * as welcome from "./chartbrewV6Welcome.js";

async function setup() {
  const state = [];
  const saved = [];
  let cursor = 0;
  const modules = {
    react: {
      default: React,
      useState: (initial) => {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (value) => { state[index] = value; }];
      },
    },
    "react-redux": {
      useSelector: (select) => select({
        user: { data: { id: 7, createdAt: "2025-01-01T00:00:00Z" } },
        team: { id: 1, TeamRoles: [{ user_id: 7, role: "teamOwner" }] },
      }),
      useDispatch: () => (action) => {
        saved.push(action);
        return { unwrap: () => Promise.resolve() };
      },
    },
    "@heroui/react": {
      Button: "button",
      Modal: Object.fromEntries(["Backdrop", "Container", "Dialog", "CloseTrigger", "Header", "Heading", "Body", "Footer"].map((name) => [name, name])),
    },
    "react-icons/lu": { LuArrowLeft: "arrow-left", LuArrowRight: "arrow-right" },
    "react-hot-toast": { default: { error: () => {} } },
    "../../../slices/user": { completeTutorial: (value) => value },
    "../../../slices/team": { selectTeam: (value) => value.team },
    "./chartbrewV6Welcome": welcome,
  };
  const context = vm.createContext({});
  const source = await readFile(new URL("./ChartbrewV6WelcomeModal.jsx", import.meta.url), "utf8");
  const { code } = await transformWithOxc(source, "ChartbrewV6WelcomeModal.jsx", { jsx: { runtime: "classic" } });
  const mod = new vm.SourceTextModule(code, { context });
  await mod.link((name) => {
    const exports = name.includes("/assets/") ? { default: name } : modules[name];
    return new vm.SyntheticModule(Object.keys(exports), function() {
      Object.entries(exports).forEach(([key, value]) => this.setExport(key, value));
    }, { context });
  });
  await mod.evaluate();
  return { saved, render: () => { cursor = 0; return mod.namespace.default(); } };
}

function nodes(element) {
  if (!React.isValidElement(element)) return [];
  return [element, ...React.Children.toArray(element.props.children).flatMap(nodes)];
}

function button(tree, label) {
  return nodes(tree).find((node) => node.type === "button"
    && (node.props["aria-label"] === label || React.Children.toArray(node.props.children).includes(label)));
}

test("tour navigation removes the video and the final button completes the tour", async () => {
  const app = await setup();
  let tree = app.render();
  const video = nodes(tree).find((node) => node.type === "video");
  assert.equal(video.props.preload, "none");
  assert.equal(video.props.controls, true);
  assert.ok(!video.props.autoPlay);
  assert.equal(button(tree, "Back").props.isDisabled, true);
  button(tree, "Next").props.onPress();
  tree = app.render();
  assert.ok(!nodes(tree).some((node) => node.type === "video"));
  button(tree, "Step 5: MCP connections").props.onPress();
  tree = app.render();
  assert.ok(nodes(tree).some((node) => node.props.children === "Your data, in your AI assistant"));
  button(tree, "Next").props.onPress();
  tree = app.render();
  assert.ok(nodes(tree).some((node) => node.props.children === "Make every report your own"));
  assert.equal(tree.props.isOpen, true);
  assert.equal(app.saved.length, 0);
  button(tree, "Get started").props.onPress();
  assert.equal(app.render().props.isOpen, false);
  assert.equal(app.saved.length, 1);
  assert.equal(app.saved[0].tutorial[welcome.CHARTBREW_V6_WELCOME_TUTORIAL], true);
});

test("only explicit modal dismissal saves the completed tour", async () => {
  const app = await setup();
  const tree = app.render();
  assert.equal(tree.props.isDismissable, false);
  assert.equal(tree.props.isKeyboardDismissDisabled, false);
  assert.ok(nodes(tree).some((node) => node.type === "CloseTrigger"));
  tree.props.onOpenChange(true);
  assert.equal(app.saved.length, 0);
  tree.props.onOpenChange(false);
  assert.equal(app.render().props.isOpen, false);
  assert.equal(app.saved.length, 1);
  assert.equal(app.saved[0].tutorial[welcome.CHARTBREW_V6_WELCOME_TUTORIAL], true);
});
