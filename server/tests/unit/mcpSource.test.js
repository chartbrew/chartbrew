import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const db = require("../../models/models");
const mcpAi = require("../../sources/plugins/mcp/ai/mcp.ai");
const { buildAiVisualization } = require("../../visualization/aiVisualization");
const { VisualizationEngine } = require("../../visualization/VisualizationEngine");
const { alignSourceChartBindings } = require("../../modules/ai/orchestrator/tools/sourceIntentRepair");
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
const jwt = require("jsonwebtoken");
const settings = require("../../settings-dev");
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
  it("exposes usable inbound exploration details and refuses unapproved dataset tools", async () => {
    const { backend } = require("../../sources/plugins/mcp/mcp.plugin");
    const tool = createTool();
    const connection = createConnection(tool);
    const catalog = await backend.exploreReadOnly({ connection, operation: "inspect", names: [tool.name], limit: 1 });
    expect(catalog.resources[0]).toMatchObject({ id: tool.name, contractFingerprint: tool.contractFingerprint, inputSchema: tool.inputSchema });
    const configuration = { source: "mcp", tool: { name: tool.name, contractFingerprint: catalog.resources[0].contractFingerprint },
      arguments: {}, output: { mode: "auto", path: [] } };
    const preview = vi.spyOn(mcpAi, "previewConfiguration").mockResolvedValue({ status: "ok", rows: [{ visits: 4 }] });
    try {
      expect((await backend.exploreReadOnly({ connection, operation: "preview", configuration, limit: 1 })).dataRequest.configuration).toMatchObject(configuration);
      expect(preview).toHaveBeenCalledOnce();
      connection.schema.mcp.allowedTools[tool.name].datasets = false;
      expect((await backend.exploreReadOnly({ connection, operation: "save", configuration })).status).toBe("invalid");
      connection.schema.mcp.allowedTools[tool.name].ask = false;
      expect((await backend.exploreReadOnly({ connection, operation: "inspect", names: [tool.name] })).resources).toEqual([]);
      expect(preview).toHaveBeenCalledOnce();
    } finally { preview.mockRestore(); }
  });

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

  it("turns a header-only pipe table into empty rows", () => {
    expect(normalizeToolResult({
      content: [{ type: "text", text: "day|visitors" }],
    })).toEqual([]);
    expect(normalizeToolResult({
      content: [{ type: "text", text: "No rows | found" }],
    })).toEqual([{ content: "No rows | found" }]);
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

  it("maps nested MCP values into named scalar columns without guessing tuple positions", async () => {
    const output = { mode: "auto", fields: { page: ["column_0"], visitors: ["column_1", "0"], previous: ["column_1", "1"] } };
    expect(selectToolOutput([["/", [899, 0]], ["/pricing", [218, null]]], output))
      .toEqual([{ page: "/", visitors: 899, previous: 0 }, { page: "/pricing", visitors: 218, previous: null }]);
    const tool = createTool();
    const plan = await mcpAi.planDataset({ connection: createConnection(tool), overrides: { toolName: tool.name, output } });
    expect(plan.configuration.output.fields).toEqual(output.fields);
    expect(plan.outputFields).toEqual(["root[].page", "root[].visitors", "root[].previous"]);
    expect(mcpProtocol.validateConfiguration(plan.configuration).configuration.output.fields).toEqual(output.fields);
    expect(() => selectToolOutput([["/", [899, 0]]], { fields: { visitors: ["column_1"] } })).toThrow("single value");
    expect(() => selectToolOutput([["/", [899, 0]]], { fields: { visitors: ["missing"] } })).toThrow("not found");
    for (const fields of [{ visitors: ["__proto__"] }, JSON.parse("{\"__proto__\":[\"id\"]}"), { visitors: "column_1.0" }]) {
      expect(mcpProtocol.validateConfiguration({ ...plan.configuration, output: { fields } }).valid).toBe(false);
      expect(() => selectToolOutput([], { fields })).toThrow("valid name and field path");
    }
  });

  it("does not apply saved mappings again to cached dataset rows", async () => {
    const cache = require("../../controllers/DataRequestCacheController");
    const connection = { ...createConnection(createTool()), id: 42 };
    const request = { id: 19, configuration: { output: { fields: { left: ["right"], right: ["left"] } } } };
    const rows = [{ left: 1, right: 2 }];
    const saved = vi.spyOn(db.Connection, "findByPk").mockResolvedValue(connection);
    const cached = vi.spyOn(cache, "findLast").mockResolvedValue({ connection_id: 42, dataRequest: request, responseData: { data: rows } });
    try {
      const result = await mcpProtocol.runDataRequest({ connection, dataRequest: request, getCache: true });
      expect(result.responseData.data).toEqual(rows);
    } finally {
      cached.mockRestore();
      saved.mockRestore();
    }
  });

  it("checks mapped rows with the chart engine and rejects empty rendered results", async () => {
    const source = { backend: { ai: mcpAi } };
    const rows = selectToolOutput([["/", [899, 0]]], { fields: { page: ["column_0"], visitors: ["column_1", "0"] } });
    const payload = { rows, type: "bar", xAxis: "root[].page", yAxis: "root[].visitors" };
    await expect(alignSourceChartBindings(source, payload)).resolves.toMatchObject({ yAxis: "root[].visitors" });
    await expect(alignSourceChartBindings(source, { ...payload, rows: [{ page: "/", visitors: 0 }] })).resolves.toBeTruthy();
    const visualization = buildAiVisualization({ chart: { type: "bar" }, cdc: payload });
    visualization.layers[0].transforms = [{ type: "filter", field: "root[].visitors", operator: "gt", value: 1000 }];
    await expect(alignSourceChartBindings(source, { ...payload, visualization })).rejects.toThrow("no usable values");
    await expect(alignSourceChartBindings(source, { ...payload, rows: [] })).rejects.toThrow("No rows");
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

  it("offers AI only tools approved for datasets and Ask", () => {
    const allowed = createTool({ name: "list_orders" });
    const datasetOnly = createTool({ name: "list_customers" });
    const askOnly = createTool({ name: "list_products" });
    const connection = createConnection(allowed);
    connection.schema.mcp.tools.push(datasetOnly, askOnly);
    connection.schema.mcp.allowedTools[datasetOnly.name] = {
      datasets: true,
      ask: false,
      confirmedReadOnly: true,
    };
    connection.schema.mcp.allowedTools[askOnly.name] = {
      datasets: false,
      ask: true,
      confirmedReadOnly: true,
    };

    const candidates = mcpAi._private.getDatasetAiCandidates(
      connection,
      "List my recent orders"
    );

    expect(candidates.map((candidate) => candidate.toolName)).toEqual([allowed.name]);
  });

  it("generates and validates an MCP dataset configuration", async () => {
    const tool = createTool({
      name: "list_orders",
      inputSchema: {
        type: "object",
        properties: { status: { type: "string" } },
        required: ["status"],
      },
    });
    const create = vi.fn()
      .mockResolvedValueOnce({ choices: [{ message: {} }] })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: "propose_mcp_dataset",
                arguments: JSON.stringify({
                  toolName: tool.name,
                  arguments: { status: "paid" },
                }),
              },
            }],
          },
        }],
      });

    const result = await mcpAi.generateConfiguration({
      client: { chat: { completions: { create } } },
      connection: createConnection(tool),
      currentConfiguration: {},
      question: "Show paid orders",
    });

    expect(result).toMatchObject({
      status: "ready",
      tool: { name: tool.name, title: tool.title },
      configuration: {
        source: "mcp",
        tool: {
          name: tool.name,
          contractFingerprint: tool.contractFingerprint,
        },
        arguments: { status: "paid" },
        output: { mode: "auto", path: [] },
      },
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("uses MCP server instructions and approved discovery results for the final setup", async () => {
    const queryTool = createTool({
      name: "execute-sql",
      title: "Execute SQL query",
      description: "Run a read-only HogQL query",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          context: { type: "string" },
        },
        required: ["query"],
      },
    });
    const discoveryTool = createTool({
      name: "event-definitions-list",
      title: "Event definitions",
      description: "List PostHog event definitions",
      inputSchema: { type: "object", properties: {} },
    });
    const connection = createConnection(queryTool);
    connection.schema.mcp.instructions = "Use HogQL. Page views use the $pageview event.";
    connection.schema.mcp.server = { name: "PostHog" };
    connection.schema.mcp.tools.push(discoveryTool);
    connection.schema.mcp.allowedTools[discoveryTool.name] = {
      datasets: false,
      ask: true,
      confirmedReadOnly: true,
      contractFingerprint: discoveryTool.contractFingerprint,
      riskFingerprint: discoveryTool.riskFingerprint,
    };

    const query = [
      "SELECT toDate(timestamp) AS day, uniqExact(distinct_id) AS visitors",
      "FROM events",
      "WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 30 DAY",
      "GROUP BY day ORDER BY day",
    ].join(" ");
    const create = vi.fn()
      .mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: "search_mcp_context",
                arguments: JSON.stringify({ query: "page view event definitions" }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: "inspect_mcp_context",
                arguments: JSON.stringify({
                  actions: [{
                    kind: "tool",
                    toolName: discoveryTool.name,
                    arguments: {},
                  }],
                }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: "propose_mcp_dataset",
                arguments: JSON.stringify({
                  toolName: queryTool.name,
                  arguments: {
                    query,
                    context: "Daily blog visitors for the last 30 days",
                  },
                }),
              },
            }],
          },
        }],
      });
    const executeSpy = vi.spyOn(mcpProtocol._private, "executeTool").mockResolvedValue({
      data: [{ event: "$pageview", description: "A page was viewed" }],
      tool: discoveryTool,
    });

    try {
      const result = await mcpAi.generateConfiguration({
        client: { chat: { completions: { create } } },
        connection,
        currentConfiguration: {},
        question: "Show visitors to my blog in the last 30 days",
      });

      expect(result.configuration.arguments.query).toBe(query);
      expect(create).toHaveBeenCalledTimes(3);
      const finalRequest = create.mock.calls[2][0];
      expect(finalRequest.messages[1].content).toContain("Use HogQL");
      expect(finalRequest.messages[1].content).toContain("$pageview");
      expect(finalRequest.messages[0].content).not.toContain("page traffic");
    } finally {
      executeSpy.mockRestore();
    }
  });

  it("revises a generated page query when its preview has no rows", async () => {
    const queryTool = createTool({
      name: "execute-sql",
      title: "Execute SQL query",
      description: "Run a read-only HogQL query",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          context: { type: "string" },
        },
        required: ["query"],
      },
    });
    const badQuery = [
      "SELECT toDate(timestamp) AS day, uniqExact(distinct_id) AS visitors",
      "FROM events WHERE properties['$current_url'] = '/blog'",
      "GROUP BY day ORDER BY day",
    ].join(" ");
    const fixedQuery = [
      "SELECT toDate(timestamp) AS day, uniqExact(distinct_id) AS visitors",
      "FROM events WHERE event = '$pageview'",
      "AND position(properties['$current_url'], '/blog') > 0",
      "GROUP BY day ORDER BY day",
    ].join(" ");
    const create = vi.fn()
      .mockResolvedValueOnce({ choices: [{ message: {} }] })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: "propose_mcp_dataset",
                arguments: JSON.stringify({
                  toolName: queryTool.name,
                  arguments: { query: badQuery },
                }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: "propose_mcp_dataset",
                arguments: JSON.stringify({
                  toolName: queryTool.name,
                  arguments: { query: fixedQuery },
                }),
              },
            }],
          },
        }],
      });
    const executeSpy = vi.spyOn(mcpProtocol._private, "executeTool")
      .mockResolvedValueOnce({ data: [], tool: queryTool })
      .mockResolvedValueOnce({
        data: [{ day: "2026-07-15", visitors: 12 }],
        tool: queryTool,
      });

    try {
      const result = await mcpAi.generateConfiguration({
        client: { chat: { completions: { create } } },
        connection: createConnection(queryTool),
        currentConfiguration: {
          tool: {
            name: queryTool.name,
            contractFingerprint: queryTool.contractFingerprint,
          },
          arguments: { query: "SELECT count() FROM events" },
          output: { mode: "auto", path: [] },
        },
        question: "Only include visitors to /blog",
      });

      expect(result.configuration.arguments.query).toBe(fixedQuery);
      expect(create).toHaveBeenCalledTimes(3);
      expect(create.mock.calls[2][0].messages[1].content).toContain("previousProposal");
      expect(executeSpy).toHaveBeenCalledTimes(2);
    } finally {
      executeSpy.mockRestore();
    }
  });

  it("rejects placeholder SQL proposals", () => {
    expect(mcpAi._private.hasPlaceholderQuery({ query: "SELECT 1" })).toBe(true);
    expect(mcpAi._private.hasPlaceholderQuery({ query: "SELECT count() FROM events" })).toBe(false);
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

  it("searches generic MCP resources without provider rules", () => {
    const connection = createConnection(createTool());
    connection.schema.mcp.resources = [{
      uri: "docs://billing/invoices",
      name: "Invoice query guide",
      description: "Fields and filters for invoice records",
      mimeType: "text/plain",
    }];

    expect(mcpAi._private.getContextResourceCandidates(
      connection,
      "invoice fields filters"
    )).toEqual([expect.objectContaining({
      uri: "docs://billing/invoices",
      name: "Invoice query guide",
    })]);
  });

  it("uses safe saved dataset context without argument values", async () => {
    const findDataset = vi.spyOn(db.Dataset, "findByPk").mockResolvedValue({
      name: "Paid invoices",
      fieldsSchema: { "root[].date": "date", "root[].amount": "number" },
      DatasetIntelligence: null,
    });
    const findRequests = vi.spyOn(db.DataRequest, "findAll").mockResolvedValue([{
      id: 12,
      configuration: {
        tool: { name: "list_invoices" },
        arguments: { status: "paid", apiToken: "must-not-leak" },
        output: { mode: "auto", path: [] },
      },
    }]);

    try {
      const context = await mcpAi._private.getExistingDatasetContext({
        id: 10,
        dataset_id: 5,
        connection_id: 3,
      });
      expect(context).toMatchObject({
        dataset: {
          name: "Paid invoices",
          fields: ["root[].date", "root[].amount"],
        },
        existingRequests: [{
          toolName: "list_invoices",
          argumentNames: ["status", "apiToken"],
        }],
      });
      expect(JSON.stringify(context)).not.toContain("must-not-leak");
    } finally {
      findDataset.mockRestore();
      findRequests.mockRestore();
    }
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
      yAxis: "root[].visitors",
    })).toMatchObject({
      xAxis: "root[].day",
      yAxis: "root[].visitors",
      dateField: "root[].day",
    });
  });

  it("requires scalar measures and keeps explicit nested tuple selections", () => {
    const rows = [{ column_0: "/", column_1: [899, 0], column_5: 0.23 }];
    const chart = { rows, type: "bar", xAxis: "root[].column_0" };
    expect(mcpAi.suggestChartBindings(rows)).toBeNull();
    expect(() => mcpAi.alignChartBindings({ ...chart, yAxis: "root[].column_1" }))
      .toThrow("does not select numeric values");
    expect(() => mcpAi.alignChartBindings({ ...chart, yAxis: "root[].visitors" }))
      .toThrow("does not select numeric values");
    expect(() => mcpAi.alignChartBindings(chart)).toThrow("Select a numeric chart measure");
    expect(mcpAi.alignChartBindings({ ...chart, yAxis: "root[].column_1[0]" }).yAxis)
      .toBe("root[].column_1[0]");
    const bindings = mcpAi.alignChartBindings({ ...chart, yAxis: "root[].column_1[0]" });
    const prepared = new VisualizationEngine({
      chart: { id: 1, type: "bar", visualization: buildAiVisualization({ chart: { type: "bar" }, cdc: bindings }) },
      datasets: [{ data: rows, options: { id: "binding-1" } }],
    }).prepare().preparedData;
    expect(prepared.results[0].rows[0]).toMatchObject({ category: "/", value: 899 });
    expect(mcpAi.alignChartBindings({ ...chart, yAxis: "root[].column_1[1]" }).yAxis)
      .toBe("root[].column_1[1]");
    expect(() => mcpAi.alignChartBindings({
      ...chart,
      yAxis: "root[].column_5",
      encoding: { value: { field: "root[].column_1", type: "quantitative" } },
    })).toThrow("does not select numeric values");
    expect(() => mcpAi.alignChartBindings({
      ...chart, yAxis: "root[].column_0", yAxisOperation: "count",
    })).not.toThrow();
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

  it("requires structured data instead of suggesting a chart of response text", async () => {
    const tool = createTool();
    const connection = createConnection(tool);
    const executeSpy = vi.spyOn(mcpProtocol._private, "executeTool").mockResolvedValue({
      data: [{ content: "visitors: current: 2363, previous: 2540; top pages: /, /tools" }], tool,
    });
    try {
      const preview = await mcpAi.previewConfiguration({
        connection,
        configuration: {
          source: "mcp", tool: { name: tool.name, contractFingerprint: tool.contractFingerprint },
          arguments: {}, output: { mode: "auto", path: [] },
        },
      });
      expect(preview.status).toBe("needs_structured_data");
      expect(preview.suggestedBindings).toBeNull();
      expect(preview.message).toContain("approved tool");
      expect(mcpAi.suggestChartBindings([{ name: "Home", category: "Page" }], { type: "table" }))
        .toEqual({ xAxis: "root[]" });
      expect(mcpAi.suggestChartBindings([{ visitors: 2363 }], { type: "kpi" }))
        .toEqual({ xAxis: "root[].visitors", yAxis: "root[].visitors" });
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
      expect(preview.warnings[0]).toMatch(/Verify the argument values/);
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

  it("accepts only a current signed conversation return for this connection and team", () => {
    const payload = { connectionId: 8, teamId: 4, conversationId: "saved-chat" };
    const state = jwt.sign(payload, settings.secret, { audience: "mcp-chat-return", expiresIn: "30m" });
    const connection = { id: 8, team_id: 4, authentication: { state } };
    expect(mcpOauth.getReturnConversation({ connection, state })).toBe("saved-chat");
    expect(mcpOauth.getReturnConversation({ connection, state: `${state}bad` })).toBeNull();
    expect(mcpOauth.getReturnConversation({ connection: { ...connection, id: 9 }, state })).toBeNull();
    expect(mcpOauth.getReturnConversation({ connection: { ...connection, team_id: 5 }, state })).toBeNull();
    const expired = jwt.sign(payload, settings.secret, { audience: "mcp-chat-return", expiresIn: -1 });
    expect(mcpOauth.getReturnConversation({ connection: { ...connection, authentication: { state: expired } }, state: expired })).toBeNull();
  });

  it("rejects an unavailable conversation before starting OAuth", async () => {
    const find = vi.spyOn(db.AiConversation, "findOne").mockResolvedValue(null);
    await expect(mcpOauth.startOAuth({
      connection: { id: 8, team_id: 4, authentication: { type: "oauth" } },
      user: { id: 3, isEditor: true }, params: { conversationId: "other-chat" },
    })).rejects.toMatchObject({ code: "MCP_CHAT_UNAVAILABLE" });
    expect(find).toHaveBeenCalledWith({ where: { id: "other-chat", team_id: 4, user_id: 3 } });
    find.mockRestore();
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
