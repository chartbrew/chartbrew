import assert from "node:assert/strict";
import test from "node:test";

import { filterConnectionCatalogue, getConnectionCatalogue } from "./connectionCatalogue.js";

const sources = [
  { id: "postgres", name: "PostgreSQL", category: "database" },
  { id: "jira", name: "Jira", category: "productivity" },
  { id: "stripeOfficial", name: "Stripe", category: "payments" },
  { id: "mcp", name: "MCP server", category: "integrations" },
];
const catalogue = getConnectionCatalogue(sources);

test("databases lead, followed by custom MCP, API, direct services, and MCP presets", () => {
  const input = [
    sources[3],
    sources[1],
    { id: "api", name: "API", category: "integrations" },
    sources[0],
    { id: "mysql", name: "MySQL", category: "database" },
  ];
  const ordered = getConnectionCatalogue(input);

  assert.deepEqual(ordered.slice(0, 5).map((entry) => entry.id), ["postgres", "mysql", "mcp", "api", "jira"]);
  assert.ok(ordered.slice(5).every((entry) => entry.method === "MCP"));
  assert.equal(filterConnectionCatalogue(ordered, "mcp", "")[0].id, "mcp");
  assert.equal(filterConnectionCatalogue(ordered, "services", "")[0].id, "api");
  assert.deepEqual(input.map((entry) => entry.id), ["mcp", "jira", "api", "postgres", "mysql"]);
});

test("MCP presets reuse the MCP source with OAuth defaults and unique picker identities", () => {
  assert.equal(new Set(catalogue.map((entry) => entry.id)).size, catalogue.length);
  const posthog = catalogue.find((entry) => entry.id === "mcp-posthog");
  assert.equal(posthog.sourceId, "mcp");
  assert.equal(posthog.connectionDefaults.host, "https://mcp.posthog.com/mcp");
  assert.equal(posthog.connectionDefaults.authentication.type, "oauth");
  assert.equal(catalogue.find((entry) => entry.id === "mcp").connectionDefaults, undefined);
  assert.equal(catalogue.find((entry) => entry.id === "jira").method, "API");
});

test("hiding the MCP source also hides all catalogue presets", () => {
  assert.equal(getConnectionCatalogue(sources.slice(0, 2)).some((entry) => entry.method === "MCP"), false);
});

test("service and MCP filters overlap and search includes service descriptions", () => {
  assert.deepEqual(filterConnectionCatalogue(catalogue, "database", "").map((entry) => entry.id), ["postgres"]);
  assert.deepEqual(filterConnectionCatalogue(catalogue, "services", " JIRA ").map((entry) => entry.id), ["jira", "mcp-atlassian"]);
  assert.deepEqual(filterConnectionCatalogue(catalogue, "mcp", "jira").map((entry) => entry.id), ["mcp-atlassian"]);
  assert.equal(filterConnectionCatalogue(catalogue, "all", "missing").length, 0);
  assert.equal(filterConnectionCatalogue(catalogue, "mcp", "").length, 15);
});

test("new MCP services use the published URLs and remain distinct from direct connections", () => {
  const hosts = {
    "mcp-linear": "https://mcp.linear.app/mcp/readonly",
    "mcp-sentry": "https://mcp.sentry.dev/mcp",
    "mcp-notion": "https://mcp.notion.com/mcp",
    "mcp-stripe": "https://mcp.stripe.com",
    "mcp-mixpanel": "https://mcp.mixpanel.com/mcp",
    "mcp-supabase": "https://mcp.supabase.com/mcp?read_only=true",
    "mcp-amplitude": "https://mcp.amplitude.com/mcp",
    "mcp-airtable": "https://mcp.airtable.com/mcp",
    "mcp-attio": "https://mcp.attio.com/mcp",
    "mcp-motherduck": "https://api.motherduck.com/mcp",
    "mcp-honeycomb": "https://mcp.honeycomb.io/mcp",
    "mcp-todoist": "https://ai.todoist.net/mcp",
  };

  for (const [id, host] of Object.entries(hosts)) {
    const entry = catalogue.find((item) => item.id === id);
    assert.equal(entry.sourceId, "mcp");
    assert.equal(entry.connectionDefaults.host, host);
    assert.equal(entry.connectionDefaults.authentication.type, "oauth");
  }

  assert.deepEqual(filterConnectionCatalogue(catalogue, "services", "Stripe").map((entry) => entry.method), ["API", "MCP"]);
});
