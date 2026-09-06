import { describe, expect, it } from "vitest";

const { getMcpEndpoint, selectTools } = require("../../sources/plugins/mcp/mcp.toolSelection");
const { mergeApprovals, sanitizeTool } = require("../../sources/plugins/mcp/mcp.policy");
const mcpProtocol = require("../../sources/plugins/mcp/mcp.protocol");
const providers = require("../../sources/plugins/mcp/mcp.providers");
const { MCP_LIMITS } = require("../../sources/plugins/mcp/mcp.constants");

describe("MCP tool selection", () => {
  const connection = (question) => ({
    host: "https://mcp.posthog.com/mcp?mode=tools&readonly=true",
    options: { mcp: { toolQuery: question } },
  });
  const largeDiscovery = {
    omittedToolCount: 280,
    tools: [{ name: "execute-sql" }, { name: "read-data-schema" }],
    allowedTools: { "survey-stats": { ask: true } },
  };
  it("keeps discovery unfiltered and only filters calls after a large list was found", () => {
    const source = connection("visitors by country");
    expect(getMcpEndpoint(source)).toBe(source.host);
    source.schema = { mcp: largeDiscovery };
    expect(getMcpEndpoint(source, { discoverTools: true })).toBe(source.host);
    const endpoint = new URL(getMcpEndpoint(source));
    expect(endpoint.searchParams.get("tools")).toBe("execute-sql,read-data-schema,survey-stats");
    expect(endpoint.searchParams.get("readonly")).toBe("true");
    source.schema.mcp = { ...largeDiscovery, omittedToolCount: 0 };
    expect(getMcpEndpoint(source)).toBe(source.host);
  });

  it("preserves explicit filters, approved tools, and unknown provider URLs", () => {
    const custom = { host: "https://other.example/mcp?tenant=one", schema: { mcp: largeDiscovery } };
    expect(getMcpEndpoint(custom)).toBe(custom.host);
    const filtered = { ...custom, host: `${connection().host}&tools=dashboard-get` };
    expect(getMcpEndpoint(filtered)).toBe(filtered.host);
    const categories = { ...custom, host: `${connection().host}&features=flags` };
    expect(getMcpEndpoint(categories)).toBe(categories.host);
  });

  it("uses a different documented filter parameter without provider-specific code", () => {
    providers.push({
      id: "fixture", url: "https://fixture.example/mcp",
      toolFilter: { parameter: "enabled_tools" },
    });
    try {
      const url = new URL(getMcpEndpoint({ host: "https://fixture.example/mcp?tenant=one", schema: { mcp: largeDiscovery } }));
      expect(url.searchParams.get("enabled_tools")).toBe("execute-sql,read-data-schema,survey-stats");
      expect(url.searchParams.has("tools")).toBe(false);
      expect(url.searchParams.get("tenant")).toBe("one");
    } finally {
      providers.pop();
    }
  });

  it("shows every tool up to the limit even when the focus does not match", () => {
    const tools = Array.from({ length: MCP_LIMITS.maxTools }, (_, id) => ({ name: `invoice_${id}` }));
    tools[0].annotations = { destructiveHint: true };
    expect(selectTools([], { question: "visitors" })).toEqual([]);
    expect(selectTools(tools.slice(0, 2), { question: "visitors" })).toEqual(tools.slice(0, 2));
    expect(selectTools(tools, { question: "visitors" })).toEqual(tools);
    expect(selectTools([...tools, { name: "visitors" }], { question: "visitors" })).toEqual([{ name: "visitors" }]);
  });

  it("selects from any large catalog without approving tools or losing existing approvals", () => {
    const tools = Array.from({ length: 400 }, (_, id) => ({
      name: `list_invoices_${id}`, inputSchema: { type: "object" }, annotations: { readOnlyHint: true },
    }));
    tools.push({ name: "customer_retention", inputSchema: { type: "object" }, annotations: { readOnlyHint: true } });
    tools.push({ name: "delete_customer_retention", annotations: { destructiveHint: true } });
    const selected = selectTools(tools, { question: "customer retention", allowedTools: { list_invoices_399: { datasets: true } } });
    expect(selected.map((tool) => tool.name)).toEqual(["list_invoices_399", "customer_retention"]);
    expect(mergeApprovals(selected.map(sanitizeTool), {})).toEqual({});
    expect(selectTools(tools)).toHaveLength(24);
    expect(selectTools(tools, { question: "no vocabulary match" }).length).toBeLessThanOrEqual(4);
  });

  it("retains approved tools beyond the starter limit and rejects unsafe focus input", async () => {
    const tools = Array.from({ length: 300 }, (_, id) => ({ name: `tool_${id}` }));
    expect(selectTools(tools, { question: "unrelated", allowedTools: Object.fromEntries(tools.slice(0, 30).map((tool) => [tool.name, { ask: true }])) })).toHaveLength(30);
    expect(() => selectTools(tools, { allowedTools: Object.fromEntries(tools.map((tool) => [tool.name, { ask: true }])) })).toThrow("Too many tools");
    await expect(mcpProtocol.prepareConnectionData({ connection: {
      ...connection(), authentication: { type: "oauth" }, options: { mcp: { toolQuery: {} } },
    } })).rejects.toThrow("tool focus");
  });
});
