import {
  beforeEach, describe, expect, it, vi
} from "vitest";

const db = require("../../models/models");
const ChartController = require("../../controllers/ChartController");
const DatasetController = require("../../controllers/DatasetController");
const firestoreProtocol = require("../../sources/plugins/firestore/firestore.protocol");
const realtimeDbProtocol = require("../../sources/plugins/realtimedb/realtimedb.protocol");
const {
  getSupportedSourceForConnection,
  getSupportedSourceIds,
} = require("../../modules/ai/orchestrator/sourceSupport");
const {
  sourcePlanDataset,
  sourcePreviewConfiguration,
  sourceValidateConfiguration,
} = require("../../modules/ai/orchestrator/tools/sourceTools");
const createTemporaryChart = require("../../modules/ai/orchestrator/tools/createTemporaryChart");
const { getSourceById } = require("../../sources");

describe("Firebase source AI layers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("declares Firestore and Realtime DB as orchestrator-supported tool sources", () => {
    expect(getSourceById("firestore").capabilities.ai).toMatchObject({
      canGenerateDatasets: true,
      canGenerateQueries: false,
      hasSourceInstructions: true,
      hasTools: true,
    });
    expect(getSourceById("realtimedb").capabilities.ai).toMatchObject({
      canGenerateDatasets: true,
      canGenerateQueries: false,
      hasSourceInstructions: true,
      hasTools: true,
    });
    expect(getSupportedSourceIds()).toEqual(expect.arrayContaining(["firestore", "realtimedb"]));
    expect(getSupportedSourceForConnection({
      type: "firestore",
      subType: "firestore",
    })?.id).toBe("firestore");
    expect(getSupportedSourceForConnection({
      type: "realtimedb",
      subType: "realtimedb",
    })?.id).toBe("realtimedb");
  });

  it("plans a Firestore collection count from available collections", async () => {
    vi.spyOn(firestoreProtocol, "getBuilderMetadata").mockResolvedValue({
      collections: [{
        id: "users",
        path: "users",
        _queryOptions: { collectionId: "users" },
      }],
    });
    const source = getSourceById("firestore");

    const plan = await source.backend.ai.planDataset({
      connection: { id: 42, type: "firestore", subType: "firestore" },
      question: "Count users",
    });

    expect(plan).toMatchObject({
      status: "ok",
      query: "users",
      configuration: {
        limit: 100,
      },
      conditions: [],
      chartSpec: {
        type: "kpi",
        yAxis: "root[]._id",
        yAxisOperation: "count",
      },
    });
  });

  it("plans Firestore filters and ordering from explicit fields", async () => {
    vi.spyOn(firestoreProtocol, "getBuilderMetadata").mockResolvedValue({
      collections: [{
        id: "orders",
        path: "orders",
        _queryOptions: { collectionId: "orders" },
      }],
    });
    const source = getSourceById("firestore");

    const plan = await source.backend.ai.planDataset({
      connection: { id: 42, type: "firestore", subType: "firestore" },
      question: "List orders where status is paid order by createdAt desc limit 25",
    });

    expect(plan).toMatchObject({
      status: "ok",
      query: "orders",
      configuration: {
        limit: 25,
        orderBy: "createdAt",
        orderByDirection: "desc",
      },
      conditions: [{
        collection: "orders",
        field: "root[].status",
        operator: "==",
        value: "paid",
      }],
    });
  });

  it("routes generic Firestore planning, validation, and preview", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "firestore",
      subType: "firestore",
      name: "Firestore",
    });
    vi.spyOn(firestoreProtocol, "getBuilderMetadata").mockResolvedValue({
      collections: [{ id: "users", path: "users" }],
    });
    vi.spyOn(firestoreProtocol, "createFirestoreConnection").mockReturnValue({
      get: vi.fn().mockResolvedValue({
        data: [{ _id: "user-1", email: "test@example.com" }],
        configuration: {},
      }),
    });

    const plan = await sourcePlanDataset({
      connection_id: 42,
      team_id: 7,
      question: "List users",
    });
    const validation = await sourceValidateConfiguration({
      connection_id: 42,
      team_id: 7,
      configuration: plan.dataRequest,
    });
    const preview = await sourcePreviewConfiguration({
      connection_id: 42,
      team_id: 7,
      configuration: plan.dataRequest,
      row_limit: 5,
    });

    expect(plan).toMatchObject({
      status: "ok",
      query: "users",
    });
    expect(validation.valid).toBe(true);
    expect(preview).toMatchObject({
      status: "ok",
      rows: [{ _id: "user-1", email: "test@example.com" }],
    });
  });

  it("fills missing Firestore query during temporary chart creation", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "firestore",
      subType: "firestore",
      name: "Firestore",
    });
    vi.spyOn(firestoreProtocol, "getBuilderMetadata").mockResolvedValue({
      collections: [{ id: "users", path: "users" }],
    });
    vi.spyOn(db.Project, "findOne").mockResolvedValue({
      id: 77,
      team_id: 7,
      ghost: true,
    });
    const createDatasetSpy = vi.spyOn(DatasetController.prototype, "createWithDataRequests").mockResolvedValue({
      id: 99,
      name: "Users count",
      DataRequests: [{ id: 1001 }],
    });
    const createChartSpy = vi.spyOn(ChartController.prototype, "createWithChartDatasetConfigs").mockResolvedValue({
      id: 55,
      name: "Users count",
      type: "kpi",
      project_id: 77,
    });
    vi.spyOn(ChartController.prototype, "takeSnapshot").mockResolvedValue(null);

    const result = await createTemporaryChart({
      team_id: 7,
      connection_id: 42,
      name: "Users count",
      original_question: "Count users from Firestore",
      type: "kpi",
      configuration: {},
    });

    expect(createDatasetSpy).toHaveBeenCalledWith(expect.objectContaining({
      dataRequests: [expect.objectContaining({
        query: "users",
        configuration: expect.objectContaining({
          limit: 100,
        }),
      })],
    }));
    expect(createChartSpy).toHaveBeenCalledWith(expect.objectContaining({
      chartDatasetConfigs: [expect.objectContaining({
        xAxis: "root[]._id",
        yAxis: "root[]._id",
        yAxisOperation: "count",
      })],
    }), null);
    expect(result).toMatchObject({
      status: "ok",
      chart_created: true,
      intent_repair: {
        planned: true,
      },
    });
  });

  it("plans a Realtime DB explicit path count", async () => {
    const source = getSourceById("realtimedb");

    const plan = await source.backend.ai.planDataset({
      question: "Count /orders",
    });

    expect(plan).toMatchObject({
      status: "ok",
      route: "orders",
      configuration: {
        limitToLast: 100,
        limitToFirst: 0,
      },
      chartSpec: {
        type: "kpi",
        yAxis: "root[]._key",
        yAxisOperation: "count",
      },
    });
  });

  it("asks for Realtime DB path context when no path is available", async () => {
    const source = getSourceById("realtimedb");

    const plan = await source.backend.ai.planDataset({
      question: "Show recent records",
    });

    expect(plan).toMatchObject({
      status: "needs_more_context",
      requiredContext: ["route"],
    });
  });

  it("routes generic Realtime DB planning, validation, and preview", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "realtimedb",
      subType: "realtimedb",
      name: "Realtime DB",
    });
    vi.spyOn(realtimeDbProtocol, "createRealtimeDatabase").mockReturnValue({
      getData: vi.fn().mockResolvedValue([{ _key: "order-1", total: 25 }]),
    });

    const plan = await sourcePlanDataset({
      connection_id: 42,
      team_id: 7,
      question: "Show latest 10 /orders",
    });
    const validation = await sourceValidateConfiguration({
      connection_id: 42,
      team_id: 7,
      configuration: plan.dataRequest,
    });
    const preview = await sourcePreviewConfiguration({
      connection_id: 42,
      team_id: 7,
      configuration: plan.dataRequest,
      row_limit: 5,
    });

    expect(plan).toMatchObject({
      status: "ok",
      route: "orders",
      configuration: {
        limitToLast: 10,
      },
    });
    expect(validation.valid).toBe(true);
    expect(preview).toMatchObject({
      status: "ok",
      rows: [{ _key: "order-1", total: 25 }],
    });
  });
});
