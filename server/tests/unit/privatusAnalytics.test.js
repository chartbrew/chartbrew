import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const apiProtocol = require("../../sources/shared/protocols/api.protocol");
const AxisChart = require("../../charts/AxisChart.js");
const { getSourceById, getSourceForConnection } = require("../../sources");
const { loadTemplate } = require("../../sources/shared/templates/chartTemplateLoader");
const { BREAKPOINT_COLS, buildTemplateLayouts } = require("../../sources/shared/templates/chartTemplateLayout");
const {
  getSiteHost,
  getSiteIdFromHost,
  getTestConnection,
} = require("../../sources/plugins/privatusAnalytics/privatusAnalytics.connection");

const SAMPLE_RESPONSES = {
  daily_traffic: {
    data: {
      period: { from: "2026-10-22T00:00:00Z", to: "2026-10-24T00:00:00Z" },
      interval: "day",
      series: [
        { date: "2026-10-22T00:00:00Z", visitors: 139, visits: 155, pageviews: 734 },
        { date: "2026-10-23T00:00:00Z", visitors: 58, visits: 66, pageviews: 516 },
      ],
    },
  },
  headline_metrics: {
    data: {
      period: { from: "2026-09-24T00:00:00Z", to: "2026-10-24T00:00:00Z" },
      metrics: {
        visitors: 671,
        visits: 751,
        pageviews: 3462,
        views_per_visit: 4.61,
        bounce_rate: 51.4,
        visit_duration: 3600,
        revenue: 0,
      },
    },
  },
};

const SAMPLE_BREAKDOWN = {
  data: {
    dimension: "country",
    page: 1,
    limit: 10,
    has_more: false,
    rows: [
      { value: "US", visitors: 200, visits: 240, pageviews: 900, share: 40.1 },
      { value: "DE", visitors: 50, visits: 60, pageviews: 210, share: 10.2 },
    ],
  },
};

function getChartDatasetConfigs(chart) {
  return chart.cdcs || [chart.cdc];
}

describe("Privatus Analytics source", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves as an API-dependent source by id and by connection", () => {
    const source = getSourceById("privatusAnalytics");

    expect(source).toMatchObject({
      id: "privatusAnalytics",
      dependsOn: ["api"],
      type: "api",
      subType: "privatusAnalytics",
      name: "Privatus Analytics",
      category: "analytics",
    });
    expect(getSourceForConnection({ type: "api", subType: "privatusAnalytics" }).id).toBe("privatusAnalytics");
    expect(source.backend.runDataRequest).toEqual(apiProtocol.runDataRequest);
    expect(source.backend.previewDataRequest).toEqual(apiProtocol.previewDataRequest);
    expect(source.backend.getDefaultDataRequest()).toMatchObject({ method: "GET", pagination: false });
  });

  it("builds site hosts only from valid site IDs", () => {
    expect(getSiteHost("pa_7Q2K9XH3AB")).toBe("https://privatusanalytics.com/sites/pa_7Q2K9XH3AB");
    expect(() => getSiteHost("pa_../../users")).toThrow("Invalid Privatus Analytics site ID");
    expect(() => getSiteHost("7Q2K9XH3AB")).toThrow("Invalid Privatus Analytics site ID");

    expect(getSiteIdFromHost("https://privatusanalytics.com/sites/pa_7Q2K9XH3AB/")).toBe("pa_7Q2K9XH3AB");
    expect(getSiteIdFromHost("https://example.com/sites/pa_7Q2K9XH3AB")).toBeNull();
    expect(getSiteIdFromHost("https://privatusanalytics.com/sites/pa_1?x=1")).toBeNull();
  });

  it("tests unsaved connections against the stats endpoint with the bearer token", async () => {
    const testApi = vi.spyOn(apiProtocol, "testApi").mockResolvedValue({ statusCode: 200, body: "{}" });
    const source = getSourceById("privatusAnalytics");

    await source.backend.testUnsavedConnection({
      connection: {
        type: "api",
        subType: "privatusAnalytics",
        host: "https://privatusanalytics.com/sites/pa_7Q2K9XH3AB",
        authentication: { type: "bearer_token", token: "pat_test" },
        options: [],
      },
    });

    const [testConnection, policyContext] = testApi.mock.calls[0];
    expect(testConnection.host).toBe("https://privatusanalytics.com/sites/pa_7Q2K9XH3AB/stats/aggregate.json?period=today");
    expect(apiProtocol.getApiTestOptions(testConnection).headers.authorization).toBe("Bearer pat_test");
    expect(policyContext.allowPrivateHost).toBe(false);
  });

  it("rejects connection tests for hosts outside Privatus Analytics", () => {
    expect(() => getTestConnection({
      type: "api",
      subType: "privatusAnalytics",
      host: "http://169.254.169.254/latest",
    })).toThrow("Invalid Privatus Analytics site ID");
  });

  it("does not echo the token when a saved connection test fails", async () => {
    const error = Object.assign(new Error("401 - unauthorized"), {
      statusCode: 401,
      options: { headers: { Authorization: "Bearer pat_secret" } },
    });
    vi.spyOn(apiProtocol, "testApi").mockRejectedValue(error);
    const source = getSourceById("privatusAnalytics");

    const thrown = await source.backend.testConnection({
      connection: {
        type: "api",
        subType: "privatusAnalytics",
        host: "https://privatusanalytics.com/sites/pa_7Q2K9XH3AB",
        authentication: { type: "bearer_token", token: "pat_secret" },
      },
    }).catch((rejection) => rejection);

    expect(thrown.message).toBe("401");
    expect(thrown.options).toBeUndefined();
    expect(JSON.stringify(thrown)).not.toContain("pat_secret");
  });

  it("keeps saved connection headers when testing", () => {
    const savedConnection = {
      type: "api",
      subType: "privatusAnalytics",
      getApiUrl: () => "https://privatusanalytics.com/sites/pa_7Q2K9XH3AB",
      getHeaders: () => [{ Authorization: "Bearer pat_saved" }],
    };

    const testConnection = getTestConnection(savedConnection);
    expect(apiProtocol.getApiTestOptions(testConnection).headers.Authorization).toBe("Bearer pat_saved");
  });

  it("ships a valid site overview template", () => {
    const template = loadTemplate("privatusAnalytics", "site-overview");
    const datasetsById = new Map(template.datasets.map((dataset) => [dataset.id, dataset]));

    expect(template.requiredConnection).toEqual({ type: "api", subType: "privatusAnalytics" });
    template.datasets.forEach((dataset) => {
      expect(dataset.dataRequest.route.startsWith("/")).toBe(true);
      expect(dataset.dataRequest.route).toMatch(/\.json\?/);
    });
    template.charts.forEach((chart) => {
      expect(chart.layoutIntent).toEqual(expect.objectContaining({
        kind: expect.any(String),
        priority: expect.any(Number),
      }));
      getChartDatasetConfigs(chart).forEach((cdc) => {
        const fields = datasetsById.get(cdc.datasetTemplateId).fieldsSchema;
        expect(fields[cdc.xAxis], `${chart.id} xAxis`).toBeTruthy();
        expect(fields[cdc.yAxis], `${chart.id} yAxis`).toBeTruthy();
      });
    });

    const dateConfigs = template.charts
      .flatMap(getChartDatasetConfigs)
      .filter((cdc) => datasetsById.get(cdc.datasetTemplateId).fieldsSchema[cdc.xAxis] === "date");
    expect(dateConfigs.length).toBeGreaterThan(0);
    dateConfigs.forEach((cdc) => {
      expect(cdc.dateField).toBe(cdc.xAxis);
      expect(cdc.yAxisOperation).toBe("sum");
    });
  });

  it("lays out every template chart without overlaps", () => {
    const template = loadTemplate("privatusAnalytics", "site-overview");
    const layouts = buildTemplateLayouts(template.charts, { existingCharts: [] });

    Object.keys(BREAKPOINT_COLS).forEach((breakpoint) => {
      template.charts.forEach((chart) => {
        expect(layouts[chart.id]?.[breakpoint]).toHaveLength(4);
      });
    });
  });

  it("plots every template chart from Privatus Analytics API responses", async () => {
    const template = loadTemplate("privatusAnalytics", "site-overview");
    const results = {};

    await Promise.all(template.charts.map(async (chartTemplate) => {
      const cdcs = getChartDatasetConfigs(chartTemplate);
      const chart = {
        id: chartTemplate.id,
        type: chartTemplate.type,
        timeInterval: chartTemplate.chart?.timeInterval || "month",
        includeZeros: true,
        ChartDatasetConfigs: cdcs.map((cdc, index) => ({ id: `cdc-${index}`, ...cdc })),
      };
      const datasets = cdcs.map((cdc, index) => {
        const dataset = template.datasets.find((item) => item.id === cdc.datasetTemplateId);
        return {
          options: { id: `cdc-${index}`, ...cdc, fieldsSchema: dataset.fieldsSchema },
          data: SAMPLE_RESPONSES[dataset.id] || SAMPLE_BREAKDOWN,
        };
      });

      const result = await new AxisChart({ chart, datasets }, "UTC").plot(false, [], {});
      results[chartTemplate.id] = result.configuration.data;
    }));

    expect(results["traffic-trend"].datasets.map((dataset) => dataset.data)).toEqual([[139, 58], [734, 516]]);
    expect(results["visitors-kpi"].datasets[0].data).toEqual([671]);
    expect(results["bounce-rate-kpi"].datasets[0].data).toEqual([51.4]);
    expect(results["top-countries"].labels).toEqual(["US", "DE"]);
    expect(results["top-countries"].datasets[0].data).toEqual([200, 50]);
  });
});
