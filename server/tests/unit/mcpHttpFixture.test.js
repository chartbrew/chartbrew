import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import http from "http";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  McpServer,
  createMcpHandler,
  fromJsonSchema,
} = require("@modelcontextprotocol/server");
const { toNodeHandler } = require("@modelcontextprotocol/node");
const { discoverMcpConnection, loadServerIcon } = require("../../sources/plugins/mcp/mcp.discovery");
const { createMcpSafeFetch } = require("../../sources/plugins/mcp/mcp.safeFetch");
const mcpProtocol = require("../../sources/plugins/mcp/mcp.protocol");

const INPUT_SCHEMA = {
  type: "object",
  properties: {
    limit: { type: "integer", minimum: 1 },
  },
  required: ["limit"],
  additionalProperties: false,
};

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function createFixtureHandler({ legacy = false, paginate = false, auth = null } = {}) {
  const factory = () => {
    const server = new McpServer({
      name: "Chartbrew fixture",
      title: "Fixture data",
      description: "A deterministic MCP fixture",
      version: "1.0.0",
    });
    server.registerTool("fixture_tool", {
      title: "Fixture tool",
      description: "Read fixture rows",
      inputSchema: fromJsonSchema(INPUT_SCHEMA),
      annotations: { readOnlyHint: true },
    }, async ({ limit }) => ({
      structuredContent: { rows: Array.from({ length: limit }, (_, index) => ({ id: index + 1 })) },
      content: [{ type: "text", text: "fixture" }],
    }));
    return server;
  };
  const baseHandler = createMcpHandler(factory, { responseMode: "json" });
  const fetch = async (request, options) => {
    if (auth?.bearer && request.headers.get("authorization") !== `Bearer ${auth.bearer}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (auth?.header
      && request.headers.get(auth.header.name) !== auth.header.value) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = request.method === "POST" ? await request.clone().json().catch(() => null) : null;
    if (legacy && body?.method === "server/discover") {
      return jsonResponse({
        jsonrpc: "2.0",
        id: body.id,
        error: { code: -32601, message: "Method not found" },
      });
    }
    if (paginate && body?.method === "tools/list") {
      const tool = body.params?.cursor
        ? {
          name: "second_fixture_tool",
          title: "Second fixture tool",
          description: "Read another fixture",
          inputSchema: { type: "object", properties: {} },
          annotations: { readOnlyHint: true },
        }
        : {
          name: "fixture_tool",
          title: "Fixture tool",
          description: "Read fixture rows",
          inputSchema: INPUT_SCHEMA,
          annotations: { readOnlyHint: true },
        };
      return jsonResponse({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          resultType: "complete",
          ttlMs: 0,
          cacheScope: "private",
          tools: [tool],
          ...(body.params?.cursor ? {} : { nextCursor: "page-2" }),
        },
      });
    }
    return baseHandler.fetch(request, options);
  };
  return {
    close: baseHandler.close,
    nodeHandler: toNodeHandler({ ...baseHandler, fetch }),
  };
}

async function startFixture(options) {
  const fixture = createFixtureHandler(options);
  const server = http.createServer(fixture.nodeHandler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {
    endpoint: `http://127.0.0.1:${address.port}/mcp`,
    close: async () => {
      await fixture.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

async function startRawServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function discoverAndCall(endpoint, connectionOverrides = {}) {
  const baseConnection = {
    type: "mcp",
    subType: "mcp",
    host: endpoint,
    authentication: { type: "none" },
    options: { mcp: {} },
    ...connectionOverrides,
  };
  const initial = await discoverMcpConnection(baseConnection, { loadIcon: false });
  const tool = initial.tools[0];
  const approval = {
    datasets: true,
    ask: false,
    confirmedReadOnly: true,
    contractFingerprint: tool.contractFingerprint,
    riskFingerprint: tool.riskFingerprint,
  };
  const discovery = await discoverMcpConnection(baseConnection, {
    loadIcon: false,
    allowedTools: { [tool.name]: approval },
  });
  const connection = {
    ...baseConnection,
    schema: { mcp: discovery },
  };
  const result = await mcpProtocol._private.executeTool(connection, {
    configuration: {
      source: "mcp",
      tool: {
        name: tool.name,
        contractFingerprint: tool.contractFingerprint,
      },
      arguments: { limit: 2 },
      output: { mode: "auto", path: [] },
    },
  });
  return { discovery, result };
}

describe("MCP HTTP fixture", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("discovers and calls a modern Streamable HTTP server", async () => {
    vi.stubEnv("CB_ALLOW_PRIVATE_NETWORK_CALLS", "true");
    const fixture = await startFixture();
    try {
      const { discovery, result } = await discoverAndCall(fixture.endpoint);
      expect(discovery.protocolEra).toBe("modern");
      expect(discovery.catalogCache).toMatchObject({
        cacheScope: "private",
        ttlMs: expect.any(Number),
      });
      expect(discovery.tools.map((tool) => tool.name)).toEqual(["fixture_tool"]);
      expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
    } finally {
      await fixture.close();
    }
  });

  it("falls back to the legacy initialization era over Streamable HTTP", async () => {
    vi.stubEnv("CB_ALLOW_PRIVATE_NETWORK_CALLS", "true");
    const fixture = await startFixture({ legacy: true });
    try {
      const { discovery, result } = await discoverAndCall(fixture.endpoint);
      expect(discovery.protocolEra).toBe("legacy");
      expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
    } finally {
      await fixture.close();
    }
  });

  it("uses bearer tokens and custom headers only from the server transport", async () => {
    vi.stubEnv("CB_ALLOW_PRIVATE_NETWORK_CALLS", "true");
    const bearerFixture = await startFixture({ auth: { bearer: "fixture-token" } });
    const headerFixture = await startFixture({
      auth: { header: { name: "x-api-key", value: "fixture-key" } },
    });
    try {
      const bearer = await discoverAndCall(bearerFixture.endpoint, {
        authentication: { type: "bearer", token: "fixture-token" },
      });
      const headers = await discoverAndCall(headerFixture.endpoint, {
        authentication: { type: "headers" },
        options: { mcp: { headers: { "x-api-key": "fixture-key" } } },
      });
      expect(bearer.result.data).toEqual([{ id: 1 }, { id: 2 }]);
      expect(headers.result.data).toEqual([{ id: 1 }, { id: 2 }]);
    } finally {
      await bearerFixture.close();
      await headerFixture.close();
    }
  });

  it("loads every tools page during discovery", async () => {
    vi.stubEnv("CB_ALLOW_PRIVATE_NETWORK_CALLS", "true");
    const fixture = await startFixture({ paginate: true });
    try {
      const connection = {
        type: "mcp",
        subType: "mcp",
        host: fixture.endpoint,
        authentication: { type: "none" },
        options: { mcp: {} },
      };
      const discovery = await discoverMcpConnection(connection, { loadIcon: false });
      expect(discovery.tools.map((tool) => tool.name)).toEqual([
        "fixture_tool",
        "second_fixture_tool",
      ]);
    } finally {
      await fixture.close();
    }
  });

  it("blocks private targets unless the instance policy allows them", async () => {
    vi.stubEnv("CB_ALLOW_PRIVATE_NETWORK_CALLS", "false");
    const safeFetch = createMcpSafeFetch();
    try {
      await expect(safeFetch.fetch("http://127.0.0.1:4019/mcp"))
        .rejects.toMatchObject({ code: "SSRF_BLOCKED", reason: "private_network" });
    } finally {
      await safeFetch.close();
    }
  });

  it("passes cancellation through the safe HTTP transport", async () => {
    vi.stubEnv("CB_ALLOW_PRIVATE_NETWORK_CALLS", "true");
    const raw = await startRawServer(() => {});
    const safeFetch = createMcpSafeFetch();
    const abortController = new AbortController();
    const request = safeFetch.fetch(`${raw.origin}/wait`, { signal: abortController.signal });
    abortController.abort();
    try {
      await expect(request).rejects.toMatchObject({ name: "AbortError" });
    } finally {
      await safeFetch.close();
      await raw.close();
    }
  });

  it("stops reading responses that exceed the configured byte limit", async () => {
    vi.stubEnv("CB_ALLOW_PRIVATE_NETWORK_CALLS", "true");
    const raw = await startRawServer((request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{\"value\":\"too large\"}");
    });
    const safeFetch = createMcpSafeFetch({ maxResponseBytes: 8 });
    try {
      const response = await safeFetch.fetch(`${raw.origin}/large`);
      await expect(response.text()).rejects.toMatchObject({ code: "MCP_RESPONSE_TOO_LARGE" });
    } finally {
      await safeFetch.close();
      await raw.close();
    }
  });

  it("applies the outbound target policy to every redirect", async () => {
    const rawServer = await startRawServer((request, response) => {
      response.writeHead(302, { location: "http://169.254.169.254/latest/meta-data" });
      response.end();
    });
    const safeFetch = createMcpSafeFetch({ allowPrivateHost: true });
    try {
      await expect(safeFetch.fetch(`${rawServer.origin}/redirect`))
        .rejects.toMatchObject({ code: "SSRF_BLOCKED", reason: "metadata_endpoint" });
    } finally {
      await safeFetch.close();
      await rawServer.close();
    }
  });

  it("rejects an icon whose bytes do not match its image type", async () => {
    vi.stubEnv("CB_ALLOW_PRIVATE_NETWORK_CALLS", "true");
    const rawServer = await startRawServer((request, response) => {
      response.writeHead(200, { "content-type": "image/png" });
      response.end("not a png");
    });
    try {
      const icon = await loadServerIcon(
        { icons: [{ src: `${rawServer.origin}/icon.png` }] },
        `${rawServer.origin}/mcp`
      );
      expect(icon).toBe("");
    } finally {
      await rawServer.close();
    }
  });
});
