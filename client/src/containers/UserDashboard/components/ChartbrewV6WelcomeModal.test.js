import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { transformWithOxc } from "vite";

import * as welcome from "./chartbrewV6Welcome.js";

async function setup(teamSettings = {}, role = "teamOwner") {
  const state = [];
  const saved = [];
  const errors = [];
  const updates = [];
  const result = { rejectSave: false };
  const videoRef = { current: null };
  let cursor = 0;
  const modules = {
    react: {
      default: React,
      useRef: () => videoRef,
      useState: (initial) => {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (value) => { state[index] = value; }];
      },
    },
    "react-redux": {
      useSelector: (select) => select({
        user: { data: { id: 7, createdAt: "2025-01-01T00:00:00Z" } },
        team: { id: 1, ...teamSettings, TeamRoles: [{ user_id: 7, role }] },
      }),
      useDispatch: () => (action) => {
        if (action.type === "updateTeam") {
          updates.push(action);
          return { unwrap: () => result.rejectSave ? Promise.reject(new Error("Failed")) : Promise.resolve() };
        }
        saved.push(action);
        return { unwrap: () => Promise.resolve() };
      },
    },
    "@heroui/react": {
      Button: "button",
      Description: "description",
      Switch: Object.assign(() => null, { Content: "switch-content", Control: "switch-control", Thumb: "switch-thumb" }),
      Modal: Object.fromEntries(["Backdrop", "Container", "Dialog", "CloseTrigger", "Header", "Heading", "Body", "Footer"].map((name) => [name, name])),
    },
    "react-icons/lu": { LuArrowLeft: "arrow-left", LuArrowRight: "arrow-right", LuPlay: "play" },
    "react-hot-toast": { default: { error: (message) => errors.push(message) } },
    "../../../slices/user": { completeTutorial: (value) => value },
    "../../../slices/team": { selectTeam: (value) => value.team, updateTeam: (value) => ({ type: "updateTeam", ...value }) },
    "../../Ai/aiEnablementCopy": { TEAM_AI_TOOLTIP: "AI data disclosure" },
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
  return { saved, updates, result, errors, videoRef, render: () => { cursor = 0; return mod.namespace.default(); } };
}

function nodes(element) {
  if (!React.isValidElement(element)) return [];
  return [element, ...React.Children.toArray(element.props.children).flatMap(nodes)];
}

function button(tree, label) {
  return nodes(tree).find((node) => node.type === "button"
    && (node.props["aria-label"] === label || React.Children.toArray(node.props.children).includes(label)));
}

test("video play button follows playback and returns when the video step opens again", async () => {
  const app = await setup();
  let tree = app.render();
  const video = nodes(tree).find((node) => node.type === "video");
  let plays = 0;
  app.videoRef.current = { play: () => { plays += 1; return Promise.resolve(); } };
  button(tree, "Play the v6 video").props.onPress();
  assert.equal(plays, 1);
  video.props.onPlay();
  tree = app.render();
  assert.ok(!button(tree, "Play the v6 video"));
  button(tree, "Step 1: Meet v6").props.onPress();
  assert.ok(!button(app.render(), "Play the v6 video"));
  video.props.onPause();
  assert.ok(button(app.render(), "Play the v6 video"));
  video.props.onPlay();
  video.props.onEnded();
  assert.ok(button(app.render(), "Play the v6 video"));
  video.props.onPlay();
  button(app.render(), "Next").props.onPress();
  assert.ok(!button(app.render(), "Play the v6 video"));
  button(app.render(), "Back").props.onPress();
  assert.ok(button(app.render(), "Play the v6 video"));

  app.videoRef.current.play = () => Promise.reject({ name: "NotSupportedError" });
  button(app.render(), "Play the v6 video").props.onPress();
  await Promise.resolve();
  assert.equal(app.errors.length, 1);
  assert.ok(button(app.render(), "Play the v6 video"));
  app.videoRef.current.play = () => Promise.reject({ name: "AbortError" });
  button(app.render(), "Play the v6 video").props.onPress();
  await Promise.resolve();
  assert.equal(app.errors.length, 1);
});

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
  assert.ok(nodes(tree).some((node) => node.props.children === "From a question to a finished chart"));
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

function switches(tree) {
  return nodes(tree).filter((node) => node.props.onChange && "isSelected" in node.props);
}

test("AI settings appear only for managers with a disabled setting", async () => {
  for (const settings of [{ aiEnabled: false }, { aiSuggestionsEnabled: false }]) {
    const app = await setup(settings);
    assert.ok(button(app.render(), "Step 2: Report themes"));
    button(app.render(), "Step 6: Chart Studio").props.onPress();
    button(app.render(), "Next").props.onPress();
    assert.equal(switches(app.render()).length, 2);
    assert.ok(switches(app.render()).every((node) => node.props.isSelected));
    assert.equal(app.updates.length, 0);
    await button(app.render(), "Get started").props.onPress();
    assert.equal(app.updates[0].data.aiEnabled, true);
    assert.equal(app.updates[0].data.aiSuggestionsEnabled, true);
    assert.equal(app.saved.length, 1);
  }
  for (const [settings, role] of [[{ aiEnabled: true, aiSuggestionsEnabled: true }, "teamOwner"], [{ aiEnabled: false }, "teamViewer"], [{ aiEnabled: false }, "teamEditor"]]) {
    const app = await setup(settings, role);
    assert.ok(!button(app.render(), "Step 7: AI settings"));
  }
});

test("Get started saves current switches and keeps the modal open on failure", async () => {
  const app = await setup({ aiEnabled: false, aiSuggestionsEnabled: false });
  button(app.render(), "Step 7: AI settings").props.onPress();
  switches(app.render())[0].props.onChange(false);
  switches(app.render())[1].props.onChange(false);
  button(app.render(), "Back").props.onPress();
  button(app.render(), "Next").props.onPress();
  assert.ok(switches(app.render()).every((node) => !node.props.isSelected));
  app.result.rejectSave = true;
  await button(app.render(), "Get started").props.onPress();
  assert.equal(app.saved.length, 0);
  assert.equal(app.render().props.isOpen, true);
  assert.ok(nodes(app.render()).some((node) => node.props.role === "alert"));
  app.result.rejectSave = false;
  switches(app.render())[1].props.onChange(true);
  await button(app.render(), "Get started").props.onPress();
  assert.equal(app.updates[1].team_id, 1);
  assert.equal(app.updates[1].data.aiEnabled, false);
  assert.equal(app.updates[1].data.aiSuggestionsEnabled, true);
  assert.equal(app.saved.length, 1);
  assert.equal(app.render().props.isOpen, false);
});

test("closing AI settings does not save the default switches", async () => {
  const app = await setup({ aiEnabled: false });
  button(app.render(), "Step 7: AI settings").props.onPress();
  app.render().props.onOpenChange(false);
  assert.equal(app.updates.length, 0);
  assert.equal(app.saved.length, 1);
});
