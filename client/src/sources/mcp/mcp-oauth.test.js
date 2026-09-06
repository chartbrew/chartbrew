import assert from "node:assert/strict";
import test from "node:test";

import { saveAndStartMcpOAuth } from "./mcp-oauth.js";

test("saves before starting OAuth with the saved connection ID", async () => {
  const calls = [];
  const url = await saveAndStartMcpOAuth({
    save: async () => {
      calls.push("save");
      return { id: 42, active: false };
    },
    startOAuth: async (id) => {
      calls.push(id);
      return { url: "https://provider.example/authorize" };
    },
  });
  assert.deepEqual(calls, ["save", 42]);
  assert.equal(url, "https://provider.example/authorize");
});

test("does not start OAuth when saving fails", async () => {
  for (const result of [false, undefined, { error: "Save failed" }]) {
    await assert.rejects(saveAndStartMcpOAuth({
      save: async () => result,
      startOAuth: () => assert.fail("OAuth must not start"),
    }), /could not be saved/);
  }
  await assert.rejects(saveAndStartMcpOAuth({
    save: async () => { throw new Error("Network error"); },
    startOAuth: () => assert.fail("OAuth must not start"),
  }), /Network error/);
});

test("reports OAuth failure and can retry with the same saved connection", async () => {
  const connection = { id: 42, active: false };
  await assert.rejects(saveAndStartMcpOAuth({
    save: async () => connection,
    startOAuth: async () => ({ error: "This server does not support OAuth." }),
  }), /does not support OAuth/);
  await assert.rejects(saveAndStartMcpOAuth({
    save: async () => connection,
    startOAuth: async () => ({}),
  }), /connection was saved/);
  assert.equal(connection.active, false);
  assert.equal(await saveAndStartMcpOAuth({
    save: async () => connection,
    startOAuth: async (id) => ({ url: `https://provider.example/authorize?connection=${id}` }),
  }), "https://provider.example/authorize?connection=42");
});
