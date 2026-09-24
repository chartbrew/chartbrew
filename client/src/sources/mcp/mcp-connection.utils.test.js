import assert from "node:assert/strict";
import test from "node:test";

import { getMcpConnectionPayload } from "./mcp-connection.utils.js";

test("connection saves omit discovery data while keeping editable fields and new approvals", () => {
  const connection = {
    id: 857,
    name: "Posthog MCP",
    host: " https://mcp.example.com/mcp ",
    authentication: { type: "oauth" },
    options: { mcp: { toolQuery: "visitors" } },
    schema: { mcp: {
      tools: [{ name: "query", description: "x".repeat(200000) }],
      icon: "x".repeat(200000),
      allowedTools: { query: { ask: true, datasets: true } },
    } },
  };
  const original = JSON.stringify(connection);
  const payload = getMcpConnectionPayload(connection, { includeApprovals: false });
  assert.equal(payload.schema, undefined);
  assert.ok(JSON.stringify(payload).length < 1024);
  assert.equal(payload.host, "https://mcp.example.com/mcp");
  assert.deepEqual(payload.authentication, connection.authentication);
  assert.deepEqual(payload.options, connection.options);
  assert.equal(payload.name, connection.name);
  assert.deepEqual(getMcpConnectionPayload(connection).schema, {
    mcp: { allowedTools: connection.schema.mcp.allowedTools },
  });
  assert.equal(JSON.stringify(connection), original);
});
