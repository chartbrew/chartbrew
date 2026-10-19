import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { getMcpConnectionPayload } from "./mcp-connection.utils.js";

const source = await readFile(new URL("./mcp-connection-form.jsx", import.meta.url), "utf8");
const handler = source.slice(source.indexOf("  const onTest ="), source.indexOf("  const onSave ="));

function setup(overrides = {}) {
  const calls = [];
  const results = [];
  const loading = [];
  const connection = {
    id: 42, name: "MCP", host: "https://new.example/mcp",
    authentication: { type: "bearer", token: "new-token" },
  };
  const context = {
    testLoading: false, saveLoading: false, oauthLoading: false,
    validate: () => true,
    editConnection: { id: 42, host: "https://old.example/mcp" },
    team: { id: 7 },
    setTestLoading: (value) => loading.push(value),
    setTestResult: (value) => results.push(value),
    buildConnection: (options) => getMcpConnectionPayload(connection, options),
    onComplete: async (payload) => {
      calls.push(["save", payload]);
      return { id: 42 };
    },
    testSavedConnection: (args) => ({ type: "saved", ...args }),
    testRequest: (args) => ({ type: "unsaved", ...args }),
    dispatch: async (action) => {
      calls.push(["test", action]);
      return { payload: { ok: true, status: 200, text: async () => '{"discovery":{"tools":[]}}' } };
    },
    parseConnectionTestBody: () => ({ message: "Connected" }),
    applyDiscovery: (discovery) => calls.push(["discovery", discovery]),
    ...overrides,
  };
  return { run: vm.runInNewContext(`${handler}\nonTest;`, context), calls, results, loading };
}

test("saves the edited URL and authentication before testing and loading tools", async () => {
  const { run, calls, results, loading } = setup();
  await run();
  assert.deepEqual(calls.map(([name]) => name), ["save", "test", "discovery"]);
  assert.equal(calls[0][1].host, "https://new.example/mcp");
  assert.equal(calls[0][1].authentication.token, "new-token");
  assert.equal(calls[0][1].schema, undefined);
  assert.equal(calls[1][1].connection_id, 42);
  assert.equal(results.at(-1).ok, true);
  assert.deepEqual(loading, [true, false]);
});

test("does not test when saving fails or throws", async () => {
  for (const onComplete of [async () => false, async () => undefined, async () => { throw new Error("Save failed"); }]) {
    const { run, calls, results, loading } = setup({ onComplete });
    await run();
    assert.deepEqual(calls, []);
    assert.equal(results.at(-1).ok, false);
    assert.match(results.at(-1).message, /could not be saved/);
    assert.deepEqual(loading, [true, false]);
  }
});

test("keeps unsaved connection tests and validation behavior", async () => {
  const unsaved = setup({ editConnection: null });
  await unsaved.run();
  assert.equal(unsaved.calls[0][0], "test");
  assert.equal(unsaved.calls[0][1].connection.host, "https://new.example/mcp");
  for (const overrides of [{ validate: () => false }, { testLoading: true }, { saveLoading: true }, { oauthLoading: true }]) {
    const blocked = setup(overrides);
    await blocked.run();
    assert.deepEqual(blocked.calls, []);
    assert.deepEqual(blocked.loading, []);
  }
});
