import assert from "node:assert/strict";
import { test } from "node:test";
import { getMcpClientType, getMcpSetup } from "./mcpSetup.js";

test("client logos match known names and use MCP for unknown clients", () => {
  for (const [name, expected] of [
    ["Codex", "openai"],
    ["codex_cli_rs", "openai"],
    ["ChatGPT", "openai"],
    ["OpenAI client", "openai"],
    ["CLAUDE CODE", "claude"],
    ["Claude (Chartbrew)", "claude"],
    ["Cursor", "cursor"],
    ["cursor-vscode", "cursor"],
    ["MCP Inspector", "mcp"],
    ["MyCodexClone", "mcp"],
    ["", "mcp"],
    [null, "mcp"],
  ]) {
    assert.equal(getMcpClientType(name), expected);
  }
});

test("setup uses the published MCP hostname and preserves the OAuth resource", () => {
  for (const url of [
    "https://mcp.chartbrew.example/mcp",
    "http://localhost:3210/mcp",
    "http://[::1]:3210/mcp",
  ]) {
    const setup = getMcpSetup(url);
    assert.equal(setup.url, url);
    assert.ok(setup.codex.includes(`--oauth-resource '${url}'`));
    assert.ok(setup.codex.endsWith("--oauth-client-registration dcr"));
    assert.equal(JSON.parse(setup.cursor).mcpServers.chartbrew.url, url);
    assert.equal(setup.local, !url.startsWith("https:"));
  }
  for (const url of [
    "javascript:alert(1)",
    "http://public.example/mcp",
    "https://a.example/mcp?x=1",
    "https://user:secret@a.example/mcp",
    "https://a.example/other",
  ]) {
    assert.throws(() => getMcpSetup(url));
  }
});
