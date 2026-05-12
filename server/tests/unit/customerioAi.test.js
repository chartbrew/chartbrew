import {
  beforeEach, describe, expect, it, vi
} from "vitest";

const db = require("../../models/models");
const ChartController = require("../../controllers/ChartController");
const DatasetController = require("../../controllers/DatasetController");
const CustomerioConnection = require("../../sources/plugins/customerio/customerio.connection");
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

describe("Customer.io AI layer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("declares Customer.io as an orchestrator-supported tool source", () => {
    const source = getSourceById("customerio");

    expect(source.capabilities.ai).toMatchObject({
      canGenerateDatasets: true,
      canGenerateQueries: false,
      hasSourceInstructions: true,
      hasTools: true,
    });
    expect(source.backend.ai.planDataset).toEqual(expect.any(Function));
    expect(source.backend.ai.previewConfiguration).toEqual(expect.any(Function));
    expect(getSupportedSourceIds()).toContain("customerio");
    expect(getSupportedSourceForConnection({
      type: "customerio",
      subType: "customerio",
    })?.id).toBe("customerio");
  });

  it("plans a customer count as a Customer.io DataRequest", async () => {
    const source = getSourceById("customerio");

    const plan = await source.backend.ai.planDataset({
      question: "Show total customers",
    });

    expect(plan).toMatchObject({
      status: "ok",
      method: "POST",
      route: "customers",
      configuration: {
        populateAttributes: false,
      },
      dataRequest: {
        method: "POST",
        route: "customers",
      },
      chartSpec: {
        type: "kpi",
        yAxis: "root.customer_count",
      },
    });
  });

  it("plans filtered customers by matching a Customer.io segment", async () => {
    vi.spyOn(CustomerioConnection, "getAllSegments").mockResolvedValue([{
      id: 10,
      name: "Paid customers",
      type: "dynamic",
    }]);
    const source = getSourceById("customerio");

    const plan = await source.backend.ai.planDataset({
      connection: { id: 42, type: "customerio", subType: "customerio" },
      question: "List customers in the Paid customers segment",
    });

    expect(plan).toMatchObject({
      status: "ok",
      route: "customers",
      configuration: {
        populateAttributes: true,
        cioFilters: {
          and: [{
            segment: {
              id: 10,
            },
          }],
        },
      },
      chartSpec: {
        type: "table",
      },
    });
  });

  it("plans recent event activities with an event name", async () => {
    const source = getSourceById("customerio");

    const plan = await source.backend.ai.planDataset({
      question: "Show recent purchase events",
    });

    expect(plan).toMatchObject({
      status: "ok",
      method: "GET",
      route: "activities",
      configuration: {
        activityType: "event",
        eventName: "purchase",
      },
      chartSpec: {
        type: "table",
      },
    });
  });

  it("plans campaign metrics when a campaign name is resolvable", async () => {
    vi.spyOn(CustomerioConnection, "getAllCampaigns").mockResolvedValue([{
      id: 123,
      name: "Welcome onboarding",
      active: true,
    }]);
    const source = getSourceById("customerio");

    const plan = await source.backend.ai.planDataset({
      connection: { id: 42, type: "customerio", subType: "customerio" },
      question: "Show email opens for the Welcome onboarding campaign in the last 14 days",
    });

    expect(plan).toMatchObject({
      status: "ok",
      method: "GET",
      route: "campaigns/123/metrics",
      configuration: {
        campaignId: 123,
        requestRoute: "metrics",
        period: "days",
        steps: 14,
        series: "opened",
        type: ["email"],
      },
      chartSpec: {
        type: "line",
        xAxis: "root.opened[].date",
        yAxis: "root.opened[].value",
      },
    });
  });

  it("asks for campaign selection when campaign metrics are ambiguous", async () => {
    vi.spyOn(CustomerioConnection, "getAllCampaigns").mockResolvedValue([{
      id: 1,
      name: "Welcome",
    }, {
      id: 2,
      name: "Activation",
    }]);
    const source = getSourceById("customerio");

    const plan = await source.backend.ai.planDataset({
      connection: { id: 42, type: "customerio", subType: "customerio" },
      question: "Show campaign click metrics",
    });

    expect(plan).toMatchObject({
      status: "needs_disambiguation",
      message: "Choose a Customer.io campaign before I build this campaign metric.",
      options: [{
        label: "Welcome",
        value: "1",
      }, {
        label: "Activation",
        value: "2",
      }],
    });
  });

  it("routes generic source planning, validation, and preview through Customer.io AI", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "customerio",
      subType: "customerio",
      name: "Customer.io",
    });
    vi.spyOn(CustomerioConnection, "getActivities").mockResolvedValue({
      activities: [{
        id: "activity-1",
        type: "event",
        name: "purchase",
      }],
      activity_count: 1,
    });

    const plan = await sourcePlanDataset({
      connection_id: 42,
      team_id: 7,
      question: "Show recent purchase events",
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
      route: "activities",
      configuration: {
        eventName: "purchase",
      },
    });
    expect(validation.valid).toBe(true);
    expect(preview).toMatchObject({
      status: "ok",
      rows: [{
        id: "activity-1",
        type: "event",
        name: "purchase",
      }],
    });
  });

  it("fills missing Customer.io route configuration during temporary chart creation", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "customerio",
      subType: "customerio",
      name: "Customer.io",
    });
    vi.spyOn(db.Project, "findOne").mockResolvedValue({
      id: 77,
      team_id: 7,
      ghost: true,
    });
    const createDatasetSpy = vi.spyOn(DatasetController.prototype, "createWithDataRequests").mockResolvedValue({
      id: 99,
      name: "Purchase events",
      DataRequests: [{ id: 1001 }],
    });
    vi.spyOn(ChartController.prototype, "createWithChartDatasetConfigs").mockResolvedValue({
      id: 55,
      name: "Purchase events",
      type: "table",
      project_id: 77,
    });
    vi.spyOn(ChartController.prototype, "takeSnapshot").mockResolvedValue(null);

    const result = await createTemporaryChart({
      team_id: 7,
      connection_id: 42,
      name: "Purchase events",
      original_question: "Show recent purchase events from Customer.io",
      type: "table",
      configuration: {},
    });

    expect(createDatasetSpy).toHaveBeenCalledWith(expect.objectContaining({
      dataRequests: [expect.objectContaining({
        method: "GET",
        route: "activities",
        itemsLimit: 100,
        configuration: expect.objectContaining({
          activityType: "event",
          eventName: "purchase",
        }),
      })],
    }));
    expect(result).toMatchObject({
      status: "ok",
      chart_created: true,
      intent_repair: {
        planned: true,
      },
    });
  });
});
