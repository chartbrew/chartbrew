import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const mcpAi = require("../../sources/plugins/mcp/ai/mcp.ai");
const { normalizeToolResult, selectToolOutput } = require("../../sources/plugins/mcp/mcp.normalize");
const {
  applyToolApproval,
  assertToolApproved,
  mergeApprovals,
  normalizeCustomHeaders,
  sanitizeMcpClientError,
  sanitizeTool,
} = require("../../sources/plugins/mcp/mcp.policy");
const mcpProtocol = require("../../sources/plugins/mcp/mcp.protocol");
const mcpOauth = require("../../sources/plugins/mcp/mcp.oauth");
const {
  applyVariables,
  applyVariablesToValue,
} = require("../../sources/plugins/mcp/mcp.variables");

afterEach(() => {
  vi.unstubAllEnvs();
});

function createTool(overrides = {}) {
  return sanitizeTool({
    name: "list_orders",
    title: "List orders",
    description: "Read order data",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        orders: { type: "array", items: { type: "object" } },
      },
    },
    annotations: { readOnlyHint: true },
    ...overrides,
  });
}

function createConnection(tool, approval = {}) {
  return {
    schema: {
      mcp: {
        tools: [tool],
        allowedTools: {
          [tool.name]: {
            datasets: true,
            ask: true,
            confirmedReadOnly: true,
            contractFingerprint: tool.contractFingerprint,
            riskFingerprint: tool.riskFingerprint,
            ...approval,
          },
        },
      },
    },
  };
}

describe("MCP source policy", () => {
  it("creates stable tool fingerprints and retains matching approvals", () => {
    const tool = createTool();
    const sameTool = createTool();
    expect(sameTool.contractFingerprint).toBe(tool.contractFingerprint);
    expect(sameTool.riskFingerprint).toBe(tool.riskFingerprint);

    const approvals = mergeApprovals([tool], {
      [tool.name]: {
        datasets: true,
        ask: false,
        confirmedReadOnly: true,
        contractFingerprint: tool.contractFingerprint,
        riskFingerprint: tool.riskFingerprint,
      },
    });
    expect(approvals[tool.name]).toMatchObject({ datasets: true, ask: false });
  });

  it("keeps approval after a contract or risk change and refreshes fingerprints", () => {
    const original = createTool();
    const changedContract = createTool({
      inputSchema: {
        type: "object",
        properties: { limit: { type: "number" } },
      },
    });
    const changedRisk = createTool({ description: "Read customer orders and related details" });
    const approval = {
      datasets: true,
      ask: true,
      confirmedReadOnly: true,
      contractFingerprint: original.contractFingerprint,
      riskFingerprint: original.riskFingerprint,
    };

    const contractApprovals = mergeApprovals([changedContract], { [original.name]: approval });
    expect(contractApprovals[original.name]).toMatchObject({
      datasets: true,
      ask: true,
      contractFingerprint: changedContract.contractFingerprint,
      riskFingerprint: changedContract.riskFingerprint,
    });

    const riskApprovals = mergeApprovals([changedRisk], { [original.name]: approval });
    expect(riskApprovals[original.name]).toMatchObject({
      datasets: true,
      ask: true,
      contractFingerprint: changedRisk.contractFingerprint,
      riskFingerprint: changedRisk.riskFingerprint,
    });
  });

  it("never approves a tool marked as destructive", () => {
    const tool = createTool({ annotations: { destructiveHint: true } });
    const approval = {
      datasets: true,
      ask: true,
      confirmedReadOnly: true,
      contractFingerprint: tool.contractFingerprint,
      riskFingerprint: tool.riskFingerprint,
    };
    expect(mergeApprovals([tool], { [tool.name]: approval })).toEqual({});
  });

  it("requires explicit approval for tools marked as read-only", () => {
    const tool = createTool();
    const defaults = mergeApprovals([tool], {});
    expect(defaults).toEqual({});

    const unconfirmed = mergeApprovals([tool], {
      [tool.name]: {
        datasets: true,
        ask: true,
        confirmedReadOnly: false,
        contractFingerprint: tool.contractFingerprint,
        riskFingerprint: tool.riskFingerprint,
      },
    });
    expect(unconfirmed).toEqual({});

    const keptOff = mergeApprovals([tool], {
      [tool.name]: {
        datasets: false,
        ask: false,
        confirmedReadOnly: true,
        contractFingerprint: tool.contractFingerprint,
        riskFingerprint: tool.riskFingerprint,
      },
    });
    expect(keptOff[tool.name]).toMatchObject({ datasets: false, ask: false });
  });

  it("does not allow unmarked tools until they are approved", () => {
    const tool = createTool({ annotations: {} });
    expect(mergeApprovals([tool], {})).toEqual({});

    const unconfirmed = mergeApprovals([tool], {
      [tool.name]: {
        datasets: true,
        ask: true,
        confirmedReadOnly: false,
        contractFingerprint: tool.contractFingerprint,
        riskFingerprint: tool.riskFingerprint,
      },
    });
    expect(unconfirmed).toEqual({});

    const approved = mergeApprovals([tool], {
      [tool.name]: {
        datasets: true,
        ask: true,
        confirmedReadOnly: true,
        contractFingerprint: tool.contractFingerprint,
        riskFingerprint: tool.riskFingerprint,
      },
    });
    expect(approved[tool.name]).toMatchObject({ datasets: true, ask: true });
  });

  it("keeps execution approval when a tool fingerprint changes", () => {
    const tool = createTool();
    const connection = createConnection(tool, { contractFingerprint: "old" });
    expect(assertToolApproved(connection, tool, "datasets")).toMatchObject({ datasets: true });
  });

  it("applies a tool approval without matching the previous fingerprints", () => {
    const tool = createTool();
    const result = applyToolApproval(
      [tool],
      {
        [tool.name]: {
          datasets: false,
          ask: false,
          confirmedReadOnly: true,
          contractFingerprint: "old",
          riskFingerprint: "old",
        },
      },
      tool.name,
      { datasets: true },
      { id: 12 }
    );
    expect(result.approval).toMatchObject({
      datasets: true,
      ask: false,
      confirmedReadOnly: true,
      contractFingerprint: tool.contractFingerprint,
      riskFingerprint: tool.riskFingerprint,
      approvedBy: 12,
    });
    expect(result.allowedTools[tool.name].datasets).toBe(true);
  });

  it("does not apply approval to a destructive tool", () => {
    const tool = createTool({ annotations: { destructiveHint: true } });
    expect(() => applyToolApproval([tool], {}, tool.name, { datasets: true }, { id: 1 }))
      .toThrow("cannot be used");
  });

  it("blocks transport-managed custom headers", () => {
    expect(() => normalizeCustomHeaders({ Authorization: "secret" }))
      .toThrow("managed by Chartbrew");
    expect(normalizeCustomHeaders({ "X-Api-Key": "secret" }))
      .toEqual({ "x-api-key": "secret" });
  });

  it("returns safe recovery errors for OAuth and transport failures", () => {
    expect(sanitizeMcpClientError({ name: "InsufficientScopeError" })).toMatchObject({
      code: "MCP_APPROVE_ACCESS",
      statusCode: 403,
    });
    expect(sanitizeMcpClientError({ name: "UnauthorizedError" })).toMatchObject({
      code: "MCP_RECONNECT_REQUIRED",
      statusCode: 401,
      message: "The MCP server rejected authentication. Check the credentials and try again.",
      details: "HTTP 401 Unauthorized",
    });
    expect(sanitizeMcpClientError(new Error("secret server details"))).toMatchObject({
      code: "MCP_REQUEST_FAILED",
      message: "The MCP server request failed. Check the connection and try again.",
    });
    expect(sanitizeMcpClientError(new Error("secret server details")).details).toBeUndefined();
  });

  it("keeps bounded HTTP details for connection failures", () => {
    const error = sanitizeMcpClientError(
      new Error("Error POSTing to endpoint (HTTP 400): {\"error\":\"invalid_request\"}")
    );
    expect(error).toMatchObject({
      code: "MCP_REQUEST_FAILED",
      message: "The MCP server request failed. Check the connection and try again.",
    });
    expect(error.details).toContain("HTTP 400");
    expect(error.details).toContain("invalid_request");
  });

  it("redacts credentials from connection error details", () => {
    const error = sanitizeMcpClientError({
      message: "Error POSTing to endpoint (HTTP 400): Bearer super-secret-token is invalid",
      status: 400,
      statusText: "Bad Request",
      text: "Bearer super-secret-token is invalid",
    });
    expect(error.details).toContain("HTTP 400");
    expect(error.details).toContain("[redacted]");
    expect(error.details).not.toContain("super-secret-token");
  });

  it("keeps captured HTTP details for unauthorized bearer responses", () => {
    const error = sanitizeMcpClientError(
      { name: "UnauthorizedError", message: "Unauthorized" },
      {
        httpError: {
          status: 401,
          statusText: "Unauthorized",
          text: "{\"error\":\"invalid_token\",\"error_description\":\"Token is not valid\"}",
          wwwAuthenticate: "Bearer error=\"invalid_token\", error_description=\"Token is not valid\"",
        },
      }
    );
    expect(error.details).toContain("HTTP 401 Unauthorized");
    expect(error.details).toContain("invalid_token");
    expect(error.details).toContain("Token is not valid");
    expect(error.details).toContain("WWW-Authenticate:");
  });

  it("maps network failures into connection error details", () => {
    const error = sanitizeMcpClientError(Object.assign(new Error("fetch failed"), {
      cause: { code: "ENOTFOUND" },
    }));
    expect(error.details).toBe("The hostname could not be resolved.");
  });

  it("truncates oversized connection error details", () => {
    const error = sanitizeMcpClientError({
      status: 400,
      text: `{"error":"${"x".repeat(2000)}"}`,
    });
    expect(error.details.length).toBeLessThanOrEqual(540);
    expect(error.details).toContain("HTTP 400");
  });
});

describe("MCP result and variable handling", () => {
  it("prefers structured tool content and selects a row array", () => {
    const normalized = normalizeToolResult({
      structuredContent: { orders: [{ id: 1 }, { id: 2 }] },
      content: [{ type: "text", text: "ignored" }],
    });
    expect(selectToolOutput(normalized, { mode: "auto" })).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("parses JSON text and wraps plain text as rows", () => {
    expect(normalizeToolResult({ content: [{ type: "text", text: "[{\"id\":1}]" }] }))
      .toEqual([{ id: 1 }]);
    expect(normalizeToolResult({ content: [{ type: "text", text: "No rows" }] }))
      .toEqual([{ content: "No rows" }]);
  });

  it("turns pipe, markdown, and CSV text tables into object rows", () => {
    expect(normalizeToolResult({
      content: [{ type: "text", text: "day|visits\n2026-07-15|42\n2026-07-16|191" }],
    })).toEqual([
      { day: "2026-07-15", visits: 42 },
      { day: "2026-07-16", visits: 191 },
    ]);
    expect(normalizeToolResult({
      content: [{
        type: "text",
        text: "| day | visits |\n| --- | --- |\n| 2026-07-15 | 42 |\n| 2026-07-16 | 191 |",
      }],
    })).toEqual([
      { day: "2026-07-15", visits: 42 },
      { day: "2026-07-16", visits: 191 },
    ]);
    expect(selectToolOutput([{
      content: "pathname,visitors\n/tools/seo,120\n/tools/utm,80",
    }])).toEqual([
      { pathname: "/tools/seo", visitors: 120 },
      { pathname: "/tools/utm", visitors: 80 },
    ]);
    expect(normalizeToolResult({
      content: [{ type: "text", text: "day\tvisits\n2026-07-15\t42\n2026-07-16\t191" }],
    })).toEqual([
      { day: "2026-07-15", visits: 42 },
      { day: "2026-07-16", visits: 191 },
    ]);
    expect(normalizeToolResult({
      content: [{ type: "text", text: "visitors\n17280" }],
    })).toEqual([{ visitors: 17280 }]);
    expect(normalizeToolResult({
      content: [{ type: "text", text: "| visitors |\n| --- |\n| 17280 |" }],
    })).toEqual([{ visitors: 17280 }]);
    expect(selectToolOutput([{ content: "visitors\n17280" }])).toEqual([{ visitors: 17280 }]);
    expect(normalizeToolResult({
      content: [{ type: "text", text: "No rows\nfound" }],
    })).toEqual([{ content: "No rows\nfound" }]);
  });

  it("rejects tool errors, interactive results, media, HTML, and resource links", () => {
    expect(() => normalizeToolResult({ isError: true, content: [] })).toThrow("returned an error");
    expect(() => normalizeToolResult({ resultType: "input_required" })).toThrow("interactive");
    expect(() => normalizeToolResult({ content: [{ type: "image", data: "data" }] })).toThrow("Media");
    expect(() => normalizeToolResult({ content: [{ type: "text", text: "<html></html>" }] })).toThrow("HTML");
    expect(() => normalizeToolResult({ content: [{ type: "resource_link", uri: "https://example.com" }] }))
      .toThrow("linked resources");
  });

  it("returns isolated server-side MCP dataset defaults", () => {
    const first = mcpProtocol.getDefaultDataRequest();
    first.configuration.arguments.changed = true;
    expect(mcpProtocol.getDefaultDataRequest()).toMatchObject({
      method: "POST",
      template: "mcp",
      configuration: {
        source: "mcp",
        arguments: {},
        output: { mode: "auto", path: [] },
      },
    });
  });

  it("selects an explicit nested output path", () => {
    const value = { payload: { records: [{ id: 1 }] } };
    expect(selectToolOutput(value, { mode: "path", path: "payload.records" }))
      .toEqual([{ id: 1 }]);
  });

  it("turns HogQL column/result tuples into object rows", () => {
    expect(selectToolOutput({
      columns: ["pathname", "visitors"],
      results: [["/tools/seo", 120], ["/tools/utm", 80]],
    })).toEqual([
      { pathname: "/tools/seo", visitors: 120 },
      { pathname: "/tools/utm", visitors: 80 },
    ]);
  });

  it("turns ClickHouse meta/data tuples into object rows", () => {
    expect(selectToolOutput({
      meta: [{ name: "day" }, { name: "visitors" }],
      data: [["2026-07-15", 12], ["2026-07-16", 18]],
    })).toEqual([
      { day: "2026-07-15", visitors: 12 },
      { day: "2026-07-16", visitors: 18 },
    ]);
  });

  it("leaves object result rows unchanged", () => {
    expect(selectToolOutput({
      columns: ["pathname", "visitors"],
      results: [{ pathname: "/tools/seo", visitors: 120 }],
    })).toEqual([{ pathname: "/tools/seo", visitors: 120 }]);
    expect(selectToolOutput({
      results: [{ pathname: "/tools/seo", visitors: 120 }],
    })).toEqual([{ pathname: "/tools/seo", visitors: 120 }]);
  });

  it("rejects dataset results above the central row limit", () => {
    expect(() => selectToolOutput(Array.from({ length: 10001 }, () => ({}))))
      .toThrow("too many rows");
  });

  it("preserves typed exact variables and interpolates embedded variables", () => {
    const result = applyVariablesToValue({
      limit: "{{limit}}",
      active: "{{active}}",
      label: "Team {{team}}",
    }, {
      limit: 25,
      active: true,
      team: "North",
    });
    expect(result).toEqual({ limit: 25, active: true, label: "Team North" });
  });

  it("applies runtime and typed default bindings through the source contract", () => {
    const dataRequest = {
      configuration: {
        arguments: {
          limit: "{{limit}}",
          active: "{{active}}",
          label: "Orders for {{account}}",
        },
      },
      VariableBindings: [
        { name: "limit", type: "number", default_value: "25" },
        { name: "active", type: "boolean", default_value: "true" },
        { name: "account", type: "string", required: true },
      ],
      Connection: { id: 8 },
    };
    const result = applyVariables({ dataRequest, variables: { account: "north" } });
    expect(result.processedDataRequest.configuration.arguments).toEqual({
      limit: 25,
      active: true,
      label: "Orders for north",
    });
    expect(result.processedDataRequest.Connection).toBe(dataRequest.Connection);
  });
});

describe("MCP source integration contracts", () => {
  it("redacts bearer and custom header secrets", () => {
    const bearer = mcpProtocol.redactConnection({
      connection: {
        type: "mcp",
        authentication: { type: "bearer", token: "secret" },
        options: { mcp: {} },
      },
    });
    expect(bearer.authentication).toEqual(expect.objectContaining({ type: "bearer", hasToken: true }));
    expect(JSON.stringify(bearer)).not.toContain("secret");

    const headers = mcpProtocol.redactConnection({
      connection: {
        type: "mcp",
        authentication: { type: "headers" },
        options: { mcp: { headers: { "x-api-key": "hidden" } } },
      },
    });
    expect(headers.authentication.headerNames).toEqual(["x-api-key"]);
    expect(JSON.stringify(headers)).not.toContain("hidden");
  });

  it("lists only tools approved for Ask", () => {
    const allowed = createTool();
    const blocked = createTool({ name: "list_customers", title: "List customers" });
    const connection = createConnection(allowed);
    connection.schema.mcp.tools.push(blocked);

    const resources = mcpAi.listResources({ connection });
    expect(resources.resources.map((resource) => resource.id)).toEqual([allowed.name]);
  });

  it("includes approved MCP tool names in the capability response", () => {
    const tool = createTool({
      name: "execute-sql",
      title: "Execute SQL",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    });

    expect(mcpAi.getCapabilities({ connection: createConnection(tool) })).toMatchObject({
      approvedToolCount: 1,
      catalog: { search: true, describe: true, truncated: false },
      approvedTools: [{
        id: "execute-sql",
        name: "Execute SQL",
        requiredArguments: ["query"],
      }],
    });
    expect(mcpAi.getCapabilities({ connection: createConnection(tool) }).approvedTools[0].inputSchema)
      .toBeUndefined();
  });

  it("keeps Ask access when a tool fingerprint changes", () => {
    const tool = createTool();
    const connection = createConnection(tool, {
      contractFingerprint: "old",
      riskFingerprint: "old",
    });
    expect(mcpAi.getCapabilities({ connection }).approvedToolCount).toBe(1);
  });

  it("searches the approved catalog and describes only requested tools", () => {
    const sql = createTool({
      name: "execute-sql",
      title: "Execute SQL",
      description: "Run a read-only SQL query over analytics events",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    });
    const events = createTool({
      name: "event-definitions-list",
      title: "Event definitions",
      description: "List event and path property definitions",
    });
    const feedback = createTool({
      name: "agent-feedback",
      title: "Agent feedback",
      description: "Send feedback about analytics results",
    });
    const connection = createConnection(sql);
    [events, feedback].forEach((tool) => {
      connection.schema.mcp.tools.push(tool);
      connection.schema.mcp.allowedTools[tool.name] = {
        datasets: true,
        ask: true,
        confirmedReadOnly: true,
        contractFingerprint: tool.contractFingerprint,
        riskFingerprint: tool.riskFingerprint,
      };
    });

    const index = mcpAi.listResources({ connection });
    expect(index).toMatchObject({ mode: "index", total: 3, truncated: false });
    expect(index.resources.map((resource) => resource.id).sort()).toEqual([
      "agent-feedback",
      "event-definitions-list",
      "execute-sql",
    ]);
    expect(index.resources.every((resource) => !resource.inputSchema)).toBe(true);

    const search = mcpAi.listResources({ connection, query: "sql event" });
    expect(search.mode).toBe("search");
    expect(search.resources.map((resource) => resource.id)).toEqual([
      "event-definitions-list",
      "execute-sql",
    ]);

    const described = mcpAi.listResources({ connection, names: ["execute-sql", "missing-tool"] });
    expect(described).toMatchObject({
      mode: "describe",
      truncated: true,
      resources: [{ id: "execute-sql", requiredArguments: ["query"] }],
    });
    expect(described.resources[0].inputSchema).toEqual(sql.inputSchema);
  });

  it("keeps a large Ask catalog compact until a tool is described", () => {
    const tools = Array.from({ length: 20 }, (_, index) => createTool({
      name: `tool-${String(index).padStart(2, "0")}`,
      title: `Tool ${index}`,
      description: `Read data for tool ${index}`,
    }));
    const connection = {
      schema: {
        mcp: {
          tools,
          allowedTools: Object.fromEntries(tools.map((tool) => [tool.name, {
            datasets: true,
            ask: true,
            confirmedReadOnly: true,
            contractFingerprint: tool.contractFingerprint,
            riskFingerprint: tool.riskFingerprint,
          }])),
        },
      },
    };

    const capabilities = mcpAi.getCapabilities({ connection });
    expect(capabilities.approvedToolCount).toBe(20);
    expect(capabilities.approvedTools).toEqual([]);
    expect(capabilities.catalog.truncated).toBe(true);

    const index = mcpAi.listResources({ connection });
    expect(index.resources).toHaveLength(15);
    expect(index.truncated).toBe(true);
    expect(index.resources[0].inputSchema).toBeUndefined();
  });

  it("remaps guessed chart bindings onto preview columns", () => {
    const rows = [
      { pathname: "/tools/seo", visitors: 120 },
      { pathname: "/tools/utm", visitors: 80 },
    ];
    expect(mcpAi.alignChartBindings({
      rows,
      type: "bar",
      xAxis: "root[].page",
      yAxis: [],
    })).toMatchObject({
      xAxis: "root[].pathname",
      yAxis: "root[].visitors",
      suggestedBindings: {
        xAxis: "root[].pathname",
        yAxis: "root[].visitors",
      },
    });
    expect(mcpAi.alignChartBindings({
      rows: [{ day: "2026-07-15", visitors: 12 }, { day: "2026-07-16", visitors: 18 }],
      type: "line",
      xAxis: "root[].page",
      yAxis: "root[].count",
    })).toMatchObject({
      xAxis: "root[].day",
      yAxis: "root[].visitors",
      dateField: "root[].day",
    });
  });

  it("returns suggestedBindings from an MCP preview", async () => {
    const tool = createTool();
    const connection = createConnection(tool);
    const executeSpy = vi.spyOn(mcpProtocol._private, "executeTool").mockResolvedValue({
      data: [{ pathname: "/tools/seo", visitors: 120 }],
      tool,
    });
    try {
      const preview = await mcpAi.previewConfiguration({
        connection,
        configuration: {
          source: "mcp",
          tool: {
            name: tool.name,
            contractFingerprint: tool.contractFingerprint,
          },
          arguments: {},
          output: { mode: "auto", path: [] },
        },
      });
      expect(preview.status).toBe("ok");
      expect(preview.columns.map((column) => column.name)).toEqual(["pathname", "visitors"]);
      expect(preview.suggestedBindings).toMatchObject({
        xAxis: "root[].pathname",
        yAxis: "root[].visitors",
      });
    } finally {
      executeSpy.mockRestore();
    }
  });

  it("warns when an MCP preview returns a zero metric", async () => {
    const tool = createTool();
    const connection = createConnection(tool);
    const executeSpy = vi.spyOn(mcpProtocol._private, "executeTool").mockResolvedValue({
      data: [{ visitors: 0 }],
      tool,
    });
    try {
      const preview = await mcpAi.previewConfiguration({
        connection,
        configuration: {
          source: "mcp",
          tool: {
            name: tool.name,
            contractFingerprint: tool.contractFingerprint,
          },
          arguments: {},
          output: { mode: "auto", path: [] },
        },
      });
      expect(preview.status).toBe("ok");
      expect(preview.warnings[0]).toMatch(/Confirm the real event/);
    } finally {
      executeSpy.mockRestore();
    }
  });

  it("does not select an MCP tool from a weak description match", async () => {
    const feedback = createTool({
      name: "agent-feedback",
      title: "Agent feedback",
      description: "Send feedback about analytics results and product events",
    });
    const sql = createTool({
      name: "execute-sql",
      title: "Execute SQL",
      description: "Run a read-only SQL query",
    });
    const connection = createConnection(feedback);
    connection.schema.mcp.tools.push(sql);
    connection.schema.mcp.allowedTools[sql.name] = {
      datasets: true,
      ask: true,
      confirmedReadOnly: true,
      contractFingerprint: sql.contractFingerprint,
      riskFingerprint: sql.riskFingerprint,
    };

    const plan = await mcpAi.planDataset({
      connection,
      question: "How many visitors used the free tools in the last 30 days?",
    });

    expect(plan.status).toBe("needs_disambiguation");
    expect(plan.options.map((option) => option.value)).toEqual([
      "agent-feedback",
      "execute-sql",
    ]);
  });

  it("asks for required tool arguments before planning a dataset", async () => {
    const tool = createTool({
      inputSchema: {
        type: "object",
        properties: { accountId: { type: "string" } },
        required: ["accountId"],
      },
    });
    const plan = await mcpAi.planDataset({
      connection: createConnection(tool),
      question: "List orders",
      overrides: { toolName: tool.name },
    });
    expect(plan).toMatchObject({
      status: "needs_more_context",
      requiredContext: ["accountId"],
    });
  });

  it("requires an owner or admin to start OAuth", async () => {
    await expect(mcpOauth.startOAuth({
      connection: { authentication: { type: "oauth" } },
      user: { isEditor: false },
    })).rejects.toMatchObject({ code: "MCP_ADMIN_REQUIRED", statusCode: 403 });
  });

  it("requires an owner or admin to update tool approvals", async () => {
    await expect(mcpProtocol.actions.updateToolApproval({
      connection: { schema: { mcp: { tools: [] } } },
      params: { toolName: "list_orders", datasets: true },
      user: { isEditor: false },
    })).rejects.toMatchObject({ code: "MCP_ADMIN_REQUIRED", statusCode: 403 });
  });

  it("uses a public HTTPS OAuth client metadata URL when available", () => {
    vi.stubEnv("VITE_APP_API_HOST_DEV", "https://chartbrew.example");
    expect(mcpOauth.getClientMetadataUrl({ id: 8, team_id: 4 })).toBe(
      "https://chartbrew.example/mcp/oauth/client-metadata?team_id=4&connection_id=8"
    );
    expect(mcpOauth.getClientMetadata({ id: 8, team_id: 4 })).toMatchObject({
      client_name: "Chartbrew",
      redirect_uris: [
        "https://chartbrew.example/team/4/connections/8/mcp/oauth/callback",
      ],
    });
  });

  it("rejects an OAuth callback with the wrong state before token exchange", async () => {
    await expect(mcpOauth.completeOAuth({
      connection: {
        id: 1,
        team_id: 1,
        authentication: { type: "oauth", state: "saved-state" },
        schema: { mcp: { setupExpiresAt: new Date(Date.now() + 60000).toISOString() } },
      },
      code: "authorization-code",
      state: "wrong-state",
    })).rejects.toMatchObject({ code: "MCP_OAUTH_STATE_INVALID" });
  });

  it("expires incomplete OAuth setup", async () => {
    await expect(mcpOauth.completeOAuth({
      connection: {
        id: 1,
        team_id: 1,
        authentication: { type: "oauth", state: "saved-state" },
        schema: { mcp: { setupExpiresAt: new Date(Date.now() - 60000).toISOString() } },
      },
      code: "authorization-code",
      state: "saved-state",
    })).rejects.toMatchObject({ code: "MCP_OAUTH_SETUP_EXPIRED" });
  });
});
