import {
  beforeEach, describe, expect, it, vi
} from "vitest";

const db = require("../../models/models");
const ChartController = require("../../controllers/ChartController");
const DatasetController = require("../../controllers/DatasetController");
const googleAnalyticsConnection = require("../../sources/plugins/googleAnalytics/googleAnalytics.connection");
const googleAnalyticsProtocol = require("../../sources/plugins/googleAnalytics/googleAnalytics.protocol");
const oauthController = require("../../controllers/OAuthController");
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

describe("Google Analytics AI layer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("declares Google Analytics as an orchestrator-supported tool source", () => {
    const source = getSourceById("googleAnalytics");

    expect(source.capabilities.ai).toMatchObject({
      canGenerateDatasets: true,
      canGenerateQueries: false,
      hasSourceInstructions: true,
      hasTools: true,
    });
    expect(source.backend.ai.planDataset).toEqual(expect.any(Function));
    expect(source.backend.ai.previewConfiguration).toEqual(expect.any(Function));
    expect(getSupportedSourceIds()).toContain("googleAnalytics");
    expect(getSupportedSourceForConnection({
      type: "googleAnalytics",
      subType: "googleAnalytics",
    })?.id).toBe("googleAnalytics");
  });

  it("plans active users over time as a GA4 configuration", async () => {
    const source = getSourceById("googleAnalytics");
    const plan = await source.backend.ai.planDataset({
      question: "Show users over time",
      overrides: {
        propertyId: "properties/123",
      },
    });

    expect(plan).toMatchObject({
      status: "ok",
      source: "googleAnalytics",
      configuration: {
        propertyId: "properties/123",
        startDate: "30daysAgo",
        endDate: "yesterday",
        metrics: "activeUsers",
        dimensions: "date",
      },
      chartSpec: {
        type: "line",
        xAxis: "root[].date",
        yAxis: "root[].activeUsers",
        dateField: "root[].date",
      },
    });
  });

  it("plans sessions by channel", async () => {
    const source = getSourceById("googleAnalytics");
    const plan = await source.backend.ai.planDataset({
      question: "Sessions by channel for the last 14 days",
      overrides: {
        propertyId: "properties/123",
      },
    });

    expect(plan).toMatchObject({
      status: "ok",
      configuration: {
        propertyId: "properties/123",
        startDate: "14daysAgo",
        endDate: "yesterday",
        metrics: "sessions",
        dimensions: "sessionDefaultChannelGroup",
      },
      chartSpec: {
        type: "bar",
        xAxis: "root[].sessionDefaultChannelGroup",
        yAxis: "root[].sessions",
      },
    });
  });

  it("plans page views by page", async () => {
    const source = getSourceById("googleAnalytics");
    const plan = await source.backend.ai.planDataset({
      question: "Page views by page",
      overrides: {
        propertyId: "properties/123",
      },
    });

    expect(plan).toMatchObject({
      status: "ok",
      configuration: {
        propertyId: "properties/123",
        metrics: "screenPageViews",
        dimensions: "pagePath",
      },
      chartSpec: {
        type: "bar",
        horizontal: true,
        xAxis: "root[].pagePath",
        yAxis: "root[].screenPageViews",
      },
    });
  });

  it("asks for disambiguation when a connection has multiple GA4 properties", async () => {
    vi.spyOn(googleAnalyticsProtocol, "getBuilderMetadata").mockResolvedValue({
      accounts: [{
        account: "accounts/1",
        displayName: "Main",
        propertySummaries: [{
          property: "properties/1",
          displayName: "Website",
        }, {
          property: "properties/2",
          displayName: "App",
        }],
      }],
    });
    const source = getSourceById("googleAnalytics");

    const plan = await source.backend.ai.planDataset({
      connection: {
        id: 42,
        team_id: 7,
        oauth_id: 9,
        type: "googleAnalytics",
      },
      question: "Show users over time",
    });

    expect(plan).toMatchObject({
      status: "needs_disambiguation",
      message: "Choose a Google Analytics property before I build this report.",
      options: [{
        label: "Main / Website",
        value: "properties/1",
        accountId: "accounts/1",
      }, {
        label: "Main / App",
        value: "properties/2",
        accountId: "accounts/1",
      }],
    });
  });

  it("returns orchestrator user-input shape when generic GA4 planning needs a property choice", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      oauth_id: 9,
      type: "googleAnalytics",
      subType: "googleAnalytics",
      name: "GA4",
    });
    vi.spyOn(googleAnalyticsProtocol, "getBuilderMetadata").mockResolvedValue({
      accounts: [{
        account: "accounts/1",
        displayName: "Main",
        propertySummaries: [{
          property: "properties/1",
          displayName: "Website",
        }, {
          property: "properties/2",
          displayName: "App",
        }],
      }],
    });

    const plan = await sourcePlanDataset({
      connection_id: 42,
      team_id: 7,
      question: "Show sessions in the last 90 days",
    });

    expect(plan).toMatchObject({
      status: "needs_disambiguation",
      needs_user_input: true,
      prompt: "Choose a Google Analytics property before I build this report.",
      options: [{
        label: "Main / Website",
        value: "properties/1",
        accountId: "accounts/1",
      }, {
        label: "Main / App",
        value: "properties/2",
        accountId: "accounts/1",
      }],
    });
  });

  it("uses original user request context to select the GA4 property automatically", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      oauth_id: 9,
      type: "googleAnalytics",
      subType: "googleAnalytics",
      name: "GA4",
    });
    vi.spyOn(googleAnalyticsProtocol, "getBuilderMetadata").mockResolvedValue({
      accounts: [{
        account: "accounts/1",
        displayName: "Main",
        propertySummaries: [{
          property: "properties/322702671",
          displayName: "Razvan Ilin - GA4",
        }, {
          property: "properties/2",
          displayName: "RemoteStandups - GA4",
        }, {
          property: "properties/3",
          displayName: "Depomo - GA4",
        }],
      }],
    });

    const plan = await sourcePlanDataset({
      connection_id: 42,
      team_id: 7,
      question: "last 90 days sessions",
      original_question: "Can you add the total sessions I had in the last 90 days for my Razvan Ilin website?",
    });

    expect(plan).toMatchObject({
      status: "ok",
      configuration: {
        accountId: "accounts/1",
        propertyId: "properties/322702671",
        startDate: "90daysAgo",
        endDate: "yesterday",
        metrics: "sessions",
      },
    });
  });

  it("resolves a GA4 property from the original question text", async () => {
    vi.spyOn(googleAnalyticsProtocol, "getBuilderMetadata").mockResolvedValue({
      accounts: [{
        account: "accounts/1",
        displayName: "Main",
        propertySummaries: [{
          property: "properties/322702671",
          displayName: "Razvan Ilin - GA4",
        }, {
          property: "properties/2",
          displayName: "RemoteStandups - GA4",
        }, {
          property: "properties/3",
          displayName: "Depomo - GA4",
        }],
      }],
    });
    const source = getSourceById("googleAnalytics");

    const plan = await source.backend.ai.planDataset({
      connection: {
        id: 42,
        team_id: 7,
        oauth_id: 9,
        type: "googleAnalytics",
      },
      question: "Can you add the total sessions I had in the last 90 days for my Razvan Ilin website?",
    });

    expect(plan).toMatchObject({
      status: "ok",
      configuration: {
        accountId: "accounts/1",
        propertyId: "properties/322702671",
        startDate: "90daysAgo",
        endDate: "yesterday",
        metrics: "sessions",
      },
      chartSpec: {
        type: "kpi",
        yAxis: "root[].sessions",
      },
    });
    expect(plan.configuration.dimensions).toBeUndefined();
  });

  it("resolves a GA4 property from a selected quick-reply label", async () => {
    vi.spyOn(googleAnalyticsProtocol, "getBuilderMetadata").mockResolvedValue({
      accounts: [{
        account: "accounts/1",
        displayName: "Main",
        propertySummaries: [{
          property: "properties/322702671",
          displayName: "Razvan Ilin - GA4",
        }, {
          property: "properties/2",
          displayName: "RemoteStandups - GA4",
        }],
      }],
    });
    const source = getSourceById("googleAnalytics");

    const plan = await source.backend.ai.planDataset({
      connection: {
        id: 42,
        team_id: 7,
        oauth_id: 9,
        type: "googleAnalytics",
      },
      question: "Use Razvan Ilin - GA4",
    });

    expect(plan).toMatchObject({
      status: "ok",
      configuration: {
        accountId: "accounts/1",
        propertyId: "properties/322702671",
      },
    });
  });

  it("validates invalid GA4 metrics", () => {
    const source = getSourceById("googleAnalytics");
    const validation = source.backend.ai.validateConfiguration({
      propertyId: "properties/123",
      startDate: "30daysAgo",
      endDate: "yesterday",
      metrics: "definitelyNotMetric",
      dimensions: "date",
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("Unsupported GA4 metric: definitelyNotMetric");
  });

  it("routes generic source planning and preview tools through Google Analytics AI", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      oauth_id: 9,
      type: "googleAnalytics",
      subType: "googleAnalytics",
      name: "GA4",
    });
    vi.spyOn(googleAnalyticsProtocol, "getBuilderMetadata").mockResolvedValue({
      metadata: {
        metrics: [{ apiName: "activeUsers", uiName: "Active users" }],
        dimensions: [{ apiName: "date", uiName: "Date" }],
      },
    });
    vi.spyOn(oauthController, "findById").mockResolvedValue({
      id: 9,
      refreshToken: "refresh-token",
    });
    vi.spyOn(googleAnalyticsConnection, "getAnalytics").mockResolvedValue([{
      date: "2026-05-01T00:00:00Z",
      activeUsers: "12",
    }]);

    const plan = await sourcePlanDataset({
      connection_id: 42,
      team_id: 7,
      question: "Show users over time",
      overrides: {
        propertyId: "properties/123",
      },
    });
    const validation = await sourceValidateConfiguration({
      connection_id: 42,
      team_id: 7,
      configuration: plan.configuration,
    });
    const preview = await sourcePreviewConfiguration({
      connection_id: 42,
      team_id: 7,
      configuration: plan.configuration,
      row_limit: 5,
    });

    expect(plan).toMatchObject({
      status: "ok",
      configuration: {
        propertyId: "properties/123",
        metrics: "activeUsers",
        dimensions: "date",
      },
    });
    expect(validation.valid).toBe(true);
    expect(preview).toMatchObject({
      status: "ok",
      rows: [{
        date: "2026-05-01T00:00:00Z",
        activeUsers: "12",
      }],
      chartSpec: {
        type: "line",
        xAxis: "root[].date",
        yAxis: "root[].activeUsers",
      },
    });
  });

  it("fills missing GA configuration during temporary chart creation instead of saving a broken request", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      oauth_id: 9,
      type: "googleAnalytics",
      subType: "googleAnalytics",
      name: "GA4",
    });
    vi.spyOn(googleAnalyticsProtocol, "getBuilderMetadata").mockResolvedValue({
      accounts: [{
        account: "accounts/1",
        displayName: "Main",
        propertySummaries: [{
          property: "properties/322702671",
          displayName: "Razvan Ilin - GA4",
        }, {
          property: "properties/2",
          displayName: "RemoteStandups - GA4",
        }, {
          property: "properties/3",
          displayName: "Depomo - GA4",
        }],
      }],
    });
    vi.spyOn(db.Project, "findOne").mockResolvedValue({
      id: 77,
      team_id: 7,
      ghost: true,
    });
    const createDatasetSpy = vi.spyOn(DatasetController.prototype, "createWithDataRequests").mockResolvedValue({
      id: 99,
      name: "Total sessions",
      DataRequests: [{ id: 1001 }],
    });
    vi.spyOn(ChartController.prototype, "createWithChartDatasetConfigs").mockResolvedValue({
      id: 55,
      name: "Total sessions",
      type: "kpi",
      project_id: 77,
    });
    vi.spyOn(ChartController.prototype, "takeSnapshot").mockResolvedValue(null);

    const result = await createTemporaryChart({
      team_id: 7,
      connection_id: 42,
      name: "Total sessions for Razvan Ilin website in the last 90 days",
      question: "last 90 days sessions",
      original_question: "Can you add the total sessions I had in the last 90 days for my Razvan Ilin website?",
      type: "kpi",
      configuration: {},
    });

    expect(createDatasetSpy).toHaveBeenCalledWith(expect.objectContaining({
      dataRequests: [expect.objectContaining({
        configuration: expect.objectContaining({
          accountId: "accounts/1",
          propertyId: "properties/322702671",
          startDate: "90daysAgo",
          endDate: "yesterday",
          metrics: "sessions",
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
