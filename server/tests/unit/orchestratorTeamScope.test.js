import {
  beforeEach, describe, expect, it, vi
} from "vitest";

const db = require("../../models/models");
const listConnections = require("../../modules/ai/orchestrator/tools/listConnections");
const getSchema = require("../../modules/ai/orchestrator/tools/getSchema");
const generateQuery = require("../../modules/ai/orchestrator/tools/generateQuery");
const { getSourceById } = require("../../sources");
const {
  requireConnectionForTeam,
  requireDatasetForTeam,
  requireProjectForTeam,
} = require("../../modules/ai/orchestrator/tools/teamScope");

describe("AI orchestrator team scope", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.openaiClient = undefined;
  });

  it("scopes list_connections to the calling team", async () => {
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role: "teamOwner" });
    vi.spyOn(db.Connection, "findAll").mockResolvedValue([
      {
        id: 12,
        active: true,
        type: "postgres",
        subType: null,
        name: "Primary DB",
      },
      {
        id: 13,
        active: true,
        type: "clickhouse",
        subType: "clickhouse",
        name: "Events Warehouse",
      },
      {
        id: 14,
        active: true,
        type: "api",
        subType: null,
        name: "Generic API",
      },
      {
        id: 15,
        active: true,
        type: "api",
        subType: "stripe",
        name: "Legacy Stripe",
      },
    ]);

    const result = await listConnections({ team_id: 7, user_id: 3 });

    expect(db.Connection.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        team_id: 7,
      },
    }));
    expect(result).toMatchObject({
      connections: [{
        id: 12,
        type: "postgres",
        subType: null,
        source_id: "postgres",
        source_name: "PostgreSQL",
        name: "Primary DB",
      }, {
        id: 13,
        type: "clickhouse",
        subType: "clickhouse",
        source_id: "clickhouse",
        source_name: "ClickHouse",
        name: "Events Warehouse",
      }, {
        id: 14,
        type: "api",
        subType: null,
        source_id: "api",
        source_name: "API",
        name: "Generic API",
      }, {
        id: 15,
        type: "api",
        subType: "stripe",
        source_id: "stripe",
        source_name: "Stripe Legacy",
        name: "Legacy Stripe",
      }],
    });
  });

  it("rejects cross-team connections in get_schema", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 44,
      team_id: 99,
      type: "postgres",
      subType: null,
      name: "Other Team DB",
      schema: [],
    });

    await expect(getSchema({
      connection_id: 44,
      team_id: 7,
    })).rejects.toThrow("Connection does not belong to the specified team");
  });

  it("routes MCP schema requests to approved source discovery without dumping cached tools", async () => {
    const connection = {
      id: 55, team_id: 7, active: true, type: "mcp", subType: "mcp",
      schema: { mcp: { tools: [{ name: "private-unapproved-tool" }], allowedTools: {} } },
    };
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue(connection);
    vi.spyOn(db.Connection, "findAll").mockResolvedValue([connection]);
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role: "teamOwner" });
    const result = await getSchema({ connection_id: 55, team_id: 7 });
    expect(result).toMatchObject({ status: "source_discovery_required", connection_id: 55 });
    expect(result.nextAction).toContain("source_list_resources");
    expect(JSON.stringify(result)).not.toContain("private-unapproved-tool");
    const source = getSourceById("mcp");
    vi.spyOn(source.backend.ai, "getCapabilities").mockReturnValue({ approvedToolCount: 1 });
    const listed = await listConnections({ team_id: 7, user_id: 3 });
    expect(listed.connections).toEqual([expect.objectContaining({
      id: 55, discovery_tool: "source_get_capabilities", planning_tool: "source_plan_dataset",
    })]);
  });

  it("rejects cross-team projects and datasets in shared team scope helpers", async () => {
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({
      id: 14,
      team_id: 3,
    });
    vi.spyOn(db.Dataset, "findByPk").mockResolvedValue({
      id: 21,
      team_id: 5,
    });

    await expect(requireProjectForTeam(14, 7)).rejects.toThrow("Project does not belong to the specified team");
    await expect(requireDatasetForTeam(21, 7)).rejects.toThrow("Dataset does not belong to the specified team");
  });

  it("allows access to same-team connections through the shared team scope helper", async () => {
    const connection = {
      id: 55,
      team_id: 7,
      type: "postgres",
      subType: null,
      name: "Scoped DB",
    };
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue(connection);

    await expect(requireConnectionForTeam(55, 7)).resolves.toEqual(connection);
  });

  it("uses source plugin AI query generation in generate_query", async () => {
    global.openaiClient = {};
    const postgres = getSourceById("postgres");
    const querySpy = vi.spyOn(postgres.backend.ai, "generateQuery").mockResolvedValue({
      query: "SELECT 1",
    });

    const result = await generateQuery({
      question: "How many users?",
      source_id: "postgres",
      schema: { tables: ["Users"], description: { Users: ["id"] } },
    });

    expect(querySpy).toHaveBeenCalledWith(expect.objectContaining({
      question: "How many users?",
      conversationHistory: [],
      schema: expect.objectContaining({
        tables: ["Users"],
        description: { Users: ["id"] },
        sourceInstructions: expect.any(String),
      }),
    }));
    expect(result).toMatchObject({
      status: "ok",
      dialect: "postgres",
      source_id: "postgres",
      query: "SELECT 1",
    });
  });
});
