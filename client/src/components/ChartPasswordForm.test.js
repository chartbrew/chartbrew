import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import PropTypes from "prop-types";
import { transformWithOxc } from "vite";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

async function loadModule(path, modules, globals = {}) {
  const context = vm.createContext(globals);
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { code } = await transformWithOxc(source, path, { jsx: { runtime: "classic" } });
  const mod = new vm.SourceTextModule(code, { context });
  await mod.link((name) => new vm.SyntheticModule(Object.keys(modules[name]), function() {
    Object.entries(modules[name]).forEach(([key, value]) => this.setExport(key, value));
  }, { context }));
  await mod.evaluate();
  return mod.namespace;
}

function nodes(element) {
  if (!React.isValidElement(element)) return [];
  return [element, ...React.Children.toArray(element.props.children).flatMap(nodes)];
}

test("the password form submits through the keyboard and shows a failed attempt", async () => {
  const state = [];
  let cursor = 0;
  const module = await loadModule("./ChartPasswordForm.jsx", {
    react: { default: React, useState: (initial) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = value; }];
    } },
    "prop-types": { default: PropTypes },
    "@heroui/react": { Button: "button", Input: "input", Label: "label", TextField: "field" },
  });
  const submitted = [];
  const render = (loading = false) => {
    cursor = 0;
    return module.default({ onSubmit: (password) => submitted.push(password), loading });
  };
  let tree = render();
  assert.equal(nodes(tree).find((node) => node.type === "button").props.isDisabled, true);
  const field = nodes(tree).find((node) => node.type === "field");
  assert.equal(field.props.type, "password");
  assert.equal(field.props.isRequired, true);
  field.props.onChange("test-password");
  tree = render();
  let prevented = false;
  tree.props.onSubmit({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(submitted, ["test-password"]);
  assert.equal(nodes(render(true)).some((node) => node.props.role === "alert"), false);
  assert.equal(nodes(render()).some((node) => node.props.role === "alert"), true);
});

test("shared and legacy chart requests send passwords in headers and preserve the prompt error", async () => {
  const requests = [];
  const module = await loadModule("../slices/chart.js", {
    "../api/dashboardChartBatch": { requestDashboardChartBatch: () => {} },
    "../api/chartHistory": { saveChartChange: () => {} },
    "@reduxjs/toolkit": { createAsyncThunk, createSlice },
    "../modules/auth": { getAuthToken: () => null },
    "../config/settings": { API_HOST: "https://charts.example" },
  }, { Headers, URLSearchParams, fetch: async (url, options) => {
    requests.push({ url, options });
    return { status: 403, json: async () => ({ code: "PASSWORD_REQUIRED" }) };
  } });
  for (const thunk of [module.getEmbeddedChart, module.getSharedChart]) {
    const result = await thunk({ embed_id: "link", share_string: "link", password: "test-password" })(() => {}, () => ({}), {});
    assert.equal(result.error.message, "PASSWORD_REQUIRED");
    assert.equal(requests.at(-1).options.headers.get("pass"), "test-password");
    assert.ok(!requests.at(-1).url.includes("test-password"));
  }
});
