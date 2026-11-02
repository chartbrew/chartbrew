const sharp = require("sharp");

const { RenderWorkerQueue } = require("../modules/chartImage/renderWorkerQueue");

function makeSmokeDocument() {
  const seriesId = "series-smoke";
  return {
    background: { mode: "default" },
    chart: { id: 1, invertGrowth: false, showGrowth: true, type: "line" },
    content: {
      branding: "chartbrew",
      companyName: true,
      dashboardName: true,
      dateRange: true,
      lastUpdated: true,
      logo: false,
      subtitle: { show: false, text: "" },
      title: { show: true, text: "Image renderer smoke test" },
    },
    height: 630,
    layout: "shareCard",
    locale: "en-US",
    metadata: {
      companyName: "Chartbrew",
      dashboardName: "Smoke test",
      dateRange: "Jan – Mar 2026",
      lastUpdated: "Updated now",
      logoDataUri: null,
    },
    preparedData: {
      frameVersion: 1,
      generatedAt: "2026-01-01T00:00:00.000Z",
      identityVersion: 1,
      resource: { id: 1, kind: "chart" },
      results: [{
        availableSeries: [{ id: seriesId, key: "string:__default__", label: "Revenue", value: null }],
        bindingId: "binding-smoke",
        fields: [
          { key: "category", role: "dimension", sourceField: "root[].month", type: "nominal" },
          { key: "value", role: "measure", sourceField: "root[].revenue", type: "quantitative" },
        ],
        id: "layer-smoke",
        mark: "line",
        name: "Revenue",
        rows: [
          { category: "Jan", seriesId, value: 12 },
          { category: "Feb", seriesId, value: 25 },
          { category: "Mar", seriesId, value: 19 },
        ],
        series: [{ id: seriesId, key: "string:__default__", label: "Revenue", value: null }],
        stats: { inputRows: 3, outputRows: 3 },
        warnings: [],
      }],
      stats: { inputRows: 3, outputRows: 3 },
      timezone: "UTC",
      version: 1,
      warnings: [],
    },
    renderContext: { timezone: "UTC" },
    theme: "light",
    visualization: {
      layers: [{
        bindingId: "binding-smoke",
        encoding: {
          category: { field: "root[].month", type: "nominal" },
          value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
        },
        goal: null,
        id: "layer-smoke",
        mark: "line",
        name: "Revenue",
        orientation: "vertical",
        stack: "none",
        style: { color: "#048BDE", fill: false, fillOpacity: 0.2 },
        transforms: [],
      }],
      settings: {
        dataLabels: false,
        legend: { visible: true },
        missingValues: { policy: "preserve" },
      },
      status: "ready",
      version: 2,
    },
    width: 1200,
  };
}

async function run() {
  const queue = new RenderWorkerQueue();
  try {
    const png = await queue.render(makeSmokeDocument());
    const metadata = await sharp(png).metadata();
    if (metadata.format !== "png" || metadata.width !== 1200 || metadata.height !== 630) {
      throw new Error("Image renderer smoke output is invalid");
    }
    process.stdout.write("Image renderer smoke test passed\n");
  } finally {
    await queue.close();
  }
}

run().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
