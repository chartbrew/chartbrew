import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  listTemplates,
  loadTemplate,
  validateTemplate,
} = require("../../sources/shared/templates/chartTemplateLoader.js");
const {
  BREAKPOINT_COLS,
  buildTemplateLayouts,
} = require("../../sources/shared/templates/chartTemplateLayout.js");
const { chartColors, Colors } = require("../../charts/colors.js");

function rectanglesOverlap(a, b) {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  return !(ax2 <= b.x || bx2 <= a.x || ay2 <= b.y || by2 <= a.y);
}

const STRIPE_ALLOWED_DATASET_COLORS = new Set([
  chartColors.blue.rgb,
  chartColors.amber.rgb,
  chartColors.teal.rgb,
  chartColors.orange.rgb,
  Colors.positive,
  Colors.negative,
]);

function getChartDatasetConfigs(chart) {
  return chart.cdcs || (chart.cdc ? [chart.cdc] : []);
}

function expectValidLayouts(charts, layouts, existingCharts = []) {
  Object.entries(BREAKPOINT_COLS).forEach(([breakpoint, breakpointCols]) => {
    const placed = existingCharts
      .map((chart) => {
        const layout = chart.layout?.[breakpoint];
        if (!layout) return null;
        const [x, y, w, h] = layout;
        return {
          id: chart.id,
          x,
          y,
          w,
          h,
        };
      })
      .filter(Boolean);

    charts.forEach((chart) => {
      const layout = layouts[chart.id]?.[breakpoint];
      expect(layout, `${chart.id} missing ${breakpoint} layout`).toEqual(expect.any(Array));
      expect(layout).toHaveLength(4);

      const [x, y, w, h] = layout;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
      expect(x + w, `${chart.id} exceeds ${breakpoint} columns`).toBeLessThanOrEqual(breakpointCols);

      const item = { id: chart.id, x, y, w, h };
      const collision = placed.find((placedItem) => rectanglesOverlap(item, placedItem));
      expect(collision, `${chart.id} overlaps ${collision?.id} at ${breakpoint}`).toBeUndefined();
      placed.push(item);
    });
  });
}

describe("chart template loader", () => {
  it("loads the Stripe core revenue template", () => {
    const template = loadTemplate("stripe", "core-revenue");

    expect(template.source).toBe("stripe");
    expect(template.slug).toBe("core-revenue");
    expect(template.requiredConnection).toEqual({
      type: "api",
      subType: "stripe",
    });
    expect(template.datasets.map((dataset) => dataset.id)).toContain("payment_intents");
    expect(template.charts.map((chart) => chart.id)).toContain("payment-volume");
  });

  it("loads the Stripe Official starter metrics template", () => {
    const template = loadTemplate("stripeOfficial", "starter-metrics");

    expect(template.source).toBe("stripeOfficial");
    expect(template.slug).toBe("starter-metrics");
    expect(template.requiredConnection).toEqual({
      type: "stripeOfficial",
      subType: "stripeOfficial",
    });
    expect(template.datasets.map((dataset) => dataset.id)).toContain("net_revenue_30d");
    expect(template.datasets.map((dataset) => dataset.id)).toContain("net_revenue_90d_weekly");
    expect(template.charts.map((chart) => chart.id)).toContain("net-revenue-kpi");
    expect(template.charts.map((chart) => chart.id)).toContain("net-revenue-over-time");
    expect(template.charts.find((chart) => chart.id === "gross-revenue-vs-fees").cdcs).toHaveLength(2);
  });

  it("rejects charts that reference missing datasets", () => {
    const template = loadTemplate("stripe", "core-revenue");
    const invalidTemplate = {
      ...template,
      charts: [{
        ...template.charts[0],
        requiredDatasetIds: ["missing_dataset"],
      }],
    };

    expect(() => validateTemplate(invalidTemplate)).toThrow("references unknown dataset");
  });

  it("keeps Stripe data requests on the Stripe pagination template", () => {
    const template = loadTemplate("stripe", "core-revenue");

    template.datasets.forEach((dataset) => {
      expect(dataset.dataRequest.route.startsWith("/")).toBe(true);
      expect(dataset.dataRequest.itemsLimit).toBe(1000);
    });
  });

  it("allows source templates backed by data request configuration", () => {
    const template = loadTemplate("stripeOfficial", "starter-metrics");

    template.datasets.forEach((dataset) => {
      expect(dataset.dataRequest.route).toBeUndefined();
      expect(dataset.dataRequest.configuration.source).toBe("stripeOfficial");
    });
  });

  it("loads the Stripe Official compiled metrics template", () => {
    const template = loadTemplate("stripeOfficial", "compiled-metrics");

    expect(template.source).toBe("stripeOfficial");
    expect(template.slug).toBe("compiled-metrics");
    expect(template.datasets.map((dataset) => dataset.id)).toContain("mrr");
    expect(template.datasets.map((dataset) => dataset.id)).toContain("customer_lifetime_value");
    expect(template.charts.map((chart) => chart.id)).toContain("subscriber-churn-rate");
    template.datasets.forEach((dataset) => {
      expect(dataset.dataRequest.configuration.mode).toBe("compiled_metric");
      expect(dataset.dataRequest.configuration.compiledMetric).toEqual(expect.any(String));
    });
  });

  it("lists Stripe Official computed metrics before starter metrics", () => {
    const templates = listTemplates("stripeOfficial");

    expect(templates.map((template) => template.slug)).toEqual([
      "compiled-metrics",
      "starter-metrics",
    ]);
  });

  it("generates Stripe Official template layouts for every selected chart and breakpoint", () => {
    const charts = [
      ...loadTemplate("stripeOfficial", "starter-metrics").charts,
      ...loadTemplate("stripeOfficial", "compiled-metrics").charts,
    ];
    const layouts = buildTemplateLayouts(charts);

    expectValidLayouts(charts, layouts);
    expect(layouts.mrr.lg[1]).toBe(0);
    expect(layouts.arr.lg[1]).toBe(0);
    expect(layouts.arpa.lg[1]).toBe(0);
    expect(layouts["customer-lifetime-value"].lg[1]).toBe(0);
    expect(layouts["net-revenue-kpi"].lg[1]).toBeGreaterThan(0);
  });

  it("generates compact Stripe Official layouts for partial selections and existing dashboards", () => {
    const starterCharts = loadTemplate("stripeOfficial", "starter-metrics").charts;
    const selectedCharts = starterCharts.filter((chart) => [
      "net-revenue-kpi",
      "gross-revenue-vs-fees",
      "latest-payments-table",
    ].includes(chart.id));
    const existingCharts = [{
      id: 123,
      layout: Object.keys(BREAKPOINT_COLS).reduce((acc, breakpoint) => ({
        ...acc,
        [breakpoint]: [0, 0, BREAKPOINT_COLS[breakpoint], 1],
      }), {}),
    }];
    const layouts = buildTemplateLayouts(selectedCharts, { existingCharts });

    expectValidLayouts(selectedCharts, layouts, existingCharts);
    expect(layouts["net-revenue-kpi"].lg[1]).toBeGreaterThanOrEqual(1);
  });

  it("uses the official limited color palette for Stripe Official template datasets", () => {
    const charts = [
      ...loadTemplate("stripeOfficial", "starter-metrics").charts,
      ...loadTemplate("stripeOfficial", "compiled-metrics").charts,
    ];

    const usedColors = new Set();
    charts.flatMap(getChartDatasetConfigs).forEach((cdc) => {
      expect(cdc.datasetColor).toEqual(expect.any(String));
      expect(
        STRIPE_ALLOWED_DATASET_COLORS.has(cdc.datasetColor),
        `${cdc.legend} uses non-official color ${cdc.datasetColor}`
      ).toBe(true);
      usedColors.add(cdc.datasetColor);
    });

    expect(usedColors.size).toBeLessThanOrEqual(STRIPE_ALLOWED_DATASET_COLORS.size);
  });

  it("lists all templates with connection requirements", () => {
    const templates = listTemplates();

    expect(templates.some((template) => template.slug === "core-revenue")).toBe(true);
    expect(templates[0].requiredConnection).toEqual(expect.objectContaining({
      type: expect.any(String),
      subType: expect.any(String),
    }));
  });
});
