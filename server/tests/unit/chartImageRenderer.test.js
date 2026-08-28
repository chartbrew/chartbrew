const path = require("path");
const { createHash } = require("crypto");
const sharp = require("sharp");

const { resolveImageLayout, resolveImageSize } = require("../../../shared/visualization/imageLayout");
const { renderImagePng, renderImageSvg } = require("../../modules/chartImage/imageRenderer");
const { RenderWorkerQueue } = require("../../modules/chartImage/renderWorkerQueue");
const { scaleEChartsDetails } = require("../../visualization/image/renderEChartsSvg");

function field(key, role = "dimension", type = "nominal") {
  return { key, role, sourceField: `root[].${key}`, type };
}

function makeVisualization(mark, encoding) {
  return {
    layers: [{
      bindingId: "binding-1",
      encoding,
      goal: null,
      id: "layer-1",
      mark,
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
  };
}

function makePrepared(mark, fields, rows) {
  const series = [{
    id: "series-1111111111111111",
    key: "string:__default__",
    label: "Revenue",
    value: null,
  }];
  return {
    frameVersion: 1,
    generatedAt: "2026-08-20T00:00:00.000Z",
    identityVersion: 1,
    resource: { id: 42, kind: "chart" },
    results: [{
      availableSeries: series,
      bindingId: "binding-1",
      fields,
      id: "layer-1",
      mark,
      name: "Revenue",
      rows: rows.map((row) => ({ ...row, seriesId: series[0].id })),
      series,
      stats: { inputRows: rows.length, outputRows: rows.length },
      warnings: [],
    }],
    stats: { inputRows: rows.length, outputRows: rows.length },
    timezone: "UTC",
    version: 1,
    warnings: [],
  };
}

function makeDocument(mark = "line", overrides = {}) {
  const isMetric = ["avg", "kpi"].includes(mark);
  const isSingleValue = isMetric || mark === "gauge";
  let preparedData = isSingleValue
    ? makePrepared(mark, [field("value", "measure", "quantitative")], [{ value: 5755 }])
    : makePrepared(mark, [
      field("category"),
      field("value", "measure", "quantitative"),
    ], [
      { category: "Jan", value: 12 },
      { category: "Feb", value: 25 },
      { category: "Mar", value: 19 },
      { category: "Apr", value: 34 },
    ]);
  let visualization = isSingleValue
    ? makeVisualization(mark, {
      value: { aggregate: "sum", field: "root[].value", type: "quantitative" },
    })
    : makeVisualization(mark, {
      category: { field: "root[].month", type: "nominal" },
      value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
    });
  if (mark === "matrix") {
    preparedData = makePrepared(mark, [
      field("time", "dimension", "temporal"),
      field("value", "measure", "quantitative"),
    ], [
      { time: "2026-08-19T00:00:00.000Z", value: 4 },
      { time: "2026-08-20T00:00:00.000Z", value: 9 },
    ]);
    visualization = makeVisualization(mark, {
      time: { field: "root[].date", type: "temporal" },
      value: { aggregate: "sum", field: "root[].count", type: "quantitative" },
    });
  }
  return {
    background: { mode: "default" },
    chart: { id: 42, invertGrowth: false, showGrowth: true, type: mark },
    content: {
      branding: "chartbrew",
      companyName: true,
      dashboardName: true,
      dateRange: true,
      lastUpdated: true,
      logo: false,
      subtitle: { show: true, text: "Strong upward trend heading into Q4" },
      title: { show: true, text: "Visits in the last 30 days" },
    },
    height: 720,
    layout: "shareCard",
    locale: "en-US",
    metadata: {
      companyName: "IntelliTeam",
      dashboardName: "Chart factory",
      dateRange: "Jul 25 – Aug 24, 2026",
      lastUpdated: "Updated Aug 24, 2026 at 10:30",
      logoDataUri: null,
    },
    preparedData,
    renderContext: { timezone: "UTC" },
    theme: "light",
    visualization,
    width: 1280,
    ...overrides,
  };
}

function makeKpiOverlayDocument(mark = "line", chartOverrides = {}) {
  const document = makeDocument(mark);
  const result = document.preparedData.results[0];
  const secondSeries = {
    id: "series-2222222222222222",
    key: "string:tools",
    label: "Tools visits",
    value: "tools",
  };
  result.series.push(secondSeries);
  [5, 9, 12, 8].forEach((value, index) => {
    result.rows.push({
      category: ["Jan", "Feb", "Mar", "Apr"][index],
      seriesId: secondSeries.id,
      value,
    });
  });
  result.stats.inputRows = result.rows.length;
  result.stats.outputRows = result.rows.length;
  document.preparedData.stats.inputRows = result.rows.length;
  document.preparedData.stats.outputRows = result.rows.length;
  document.visualization.layers[0].style.series = {
    "series-1111111111111111": { color: "#048BDE" },
    "series-2222222222222222": { color: "#F59E0B" },
  };
  document.chart = {
    ...document.chart,
    mode: "kpichart",
    ...chartOverrides,
  };
  return document;
}

function normalizeGolden(svg) {
  return svg
    .replace(/<style>[\s\S]*?<\/style>/, "<style>[embedded-font]</style>")
    .replace(/\s+/g, " ")
    .trim();
}

describe("chart image rendering", () => {
  const supportedPresets = [
    "line", "bar", "horizontalBar", "pie", "doughnut", "radar", "polar", "matrix", "gauge",
    "kpi", "avg",
  ];

  it("normalizes fixed and original image sizes", () => {
    expect(resolveImageSize({ preset: "landscape" })).toEqual({ height: 720, width: 1280 });
    expect(resolveImageSize({ preset: "mobile" })).toEqual({ height: 2340, width: 1080 });
    expect(resolveImageSize({ preset: "original", sourceHeight: 200, sourceWidth: 400 }))
      .toEqual({ height: 480, width: 960 });
  });

  it("keeps a centered 4:3 card on portrait mobile canvases", () => {
    const layout = resolveImageLayout({
      content: {
        branding: "chartbrew",
        companyName: true,
        dashboardName: true,
        title: { show: true, text: "Visits" },
      },
      height: 2340,
      layout: "shareCard",
      width: 1080,
    });
    expect(layout.card.width / layout.card.height).toBeCloseTo(4 / 3, 2);
    expect(layout.chart.height).toBeLessThan(layout.canvas.height * 0.45);
    expect(layout.identity.y).toBeLessThan(layout.card.y);
    expect(layout.branding.y).toBeGreaterThan(layout.card.y + layout.card.height);
    expect(layout.detailScale).toBe(3);
    expect(layout.textScales.branding).toBeCloseTo(2.4, 5);
    expect(layout.textScales.content).toBe(2.1);
    expect(layout.textScales.identity).toBe(3);
  });

  it("scales image details without changing chart data or responsive thresholds", () => {
    const option = {
      grid: { bottom: 8, left: 8, right: 8, top: 32 },
      media: [{
        option: { xAxis: { axisLabel: { fontSize: 10, margin: 6 } } },
        query: { maxWidth: 520 },
      }],
      series: [{ data: [12, 25], lineStyle: { width: 2 }, symbolSize: 6 }],
    };
    const scaled = scaleEChartsDetails(option, 3);
    expect(scaled.grid).toEqual({ bottom: 24, left: 24, right: 24, top: 96 });
    expect(scaled.media[0].query.maxWidth).toBe(520);
    expect(scaled.media[0].option.xAxis.axisLabel).toEqual({ fontSize: 30, margin: 18 });
    expect(scaled.series[0].data).toEqual([12, 25]);
    expect(scaled.series[0].lineStyle.width).toBe(6);
    expect(scaled.series[0].symbolSize).toBe(18);
  });

  it("scales chart details without changing the share-card layout scale", () => {
    const landscape = resolveImageLayout({
      content: { title: { show: true, text: "Visits" } },
      height: 720,
      layout: "shareCard",
      width: 1280,
    });
    const original = resolveImageLayout({
      content: { title: { show: true, text: "Visits" } },
      height: 1200,
      layout: "shareCard",
      width: 2400,
    });
    expect(landscape.scale).toBe(1);
    expect(landscape.detailScale).toBeCloseTo(4 / 3, 5);
    expect(landscape.textScales.identity).toBeCloseTo(4 / 3, 5);
    expect(landscape.textScales.content).toBeCloseTo(4 / 3, 5);
    expect(original.scale).toBeCloseTo(1200 / 720, 5);
    expect(original.detailScale).toBe(2);
    expect(original.textScales).toEqual({ branding: 2, content: 2, identity: 2 });
    expect(original.scale).toBeGreaterThan(landscape.scale);
  });

  it("renders chart vectors at a design size and scales them up with larger output", () => {
    const svg = renderImageSvg(makeDocument("line", { height: 1200, width: 2400 }));
    const nested = svg.match(/<svg x="[^"]+" y="[^"]+" width="(\d+)" height="(\d+)" viewBox="0 0 (\d+) (\d+)"/);
    expect(nested).not.toBeNull();
    expect(Number(nested[1])).toBeGreaterThan(Number(nested[3]));
  });

  it("scales mobile image text without changing the card geometry", () => {
    const svg = renderImageSvg(makeDocument("line", { height: 2340, width: 1080 }));
    expect(svg).toContain('<rect x="44" y="804" width="992" height="744"');
    expect(svg).toContain('font-size="48" font-weight="700"');
    expect(svg).toContain('font-size="42" font-weight="500"');
    expect(svg).toContain('font-size="59" font-weight="700"');
    expect(svg).toContain('font-size="48" font-weight="400"');
  });

  it("renders a deterministic line share card SVG and PNG", async () => {
    const document = makeDocument("line");
    const first = renderImageSvg(document);
    const second = renderImageSvg(document);
    expect(first).toBe(second);
    expect(first).toContain("Visits in the last 30 days");
    expect(first).toContain("Powered by");
    expect(first).toContain(">chart</tspan>");
    expect(first).toContain(">brew</tspan>");
    expect(first).toContain('font-size="15"');
    expect(first).toContain('font-size="27"');
    expect(first).not.toContain('fill="#F17041"');
    expect(first).not.toContain("Jul 25 – Aug 24, 2026");
    expect(first).not.toContain("Updated Aug 24, 2026 at 10:30");
    expect(first).not.toContain("font-family:Inter, sans-serif");
    expect(first).not.toMatch(/<script|<foreignObject/i);
    expect(normalizeGolden(first)).toMatchSnapshot();

    const png = await renderImagePng(document);
    const metadata = await sharp(png).metadata();
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(metadata).toEqual(expect.objectContaining({ format: "png", height: 720, width: 1280 }));
  });

  it.each(["line", "bar"])("renders the KPI segment above a %s chart", (mark) => {
    const svg = renderImageSvg(makeKpiOverlayDocument(mark));
    const nestedSvgs = [...svg.matchAll(
      /<svg x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g
    )];
    expect(svg).toContain('data-kpi-overlay="true"');
    expect(svg).toContain('data-kpi-growth="positive"');
    expect(svg).toContain('data-kpi-growth="negative"');
    expect(svg).toContain('fill="#048BDE"');
    expect(svg).toContain('fill="#F59E0B"');
    expect(svg).toContain("Revenue");
    expect(svg).toContain("Tools visits");
    expect(nestedSvgs.length).toBeGreaterThanOrEqual(2);
    expect(Number(nestedSvgs[1][2])).toBeGreaterThan(Number(nestedSvgs[0][2]));
  });

  it("renders KPI values without growth when growth is hidden", () => {
    const svg = renderImageSvg(makeKpiOverlayDocument("line", { showGrowth: false }));
    expect(svg).toContain('data-kpi-overlay="true"');
    expect(svg).toContain("Tools visits");
    expect(svg).not.toContain("data-kpi-growth");
  });

  it("does not render the KPI segment in standard chart mode", () => {
    const svg = renderImageSvg(makeKpiOverlayDocument("line", { mode: "chart" }));
    expect(svg).not.toContain("data-kpi-overlay");
  });

  it("renders a native KPI without Chart.js", async () => {
    const document = makeDocument("kpi", {
      content: {
        ...makeDocument("kpi").content,
        subtitle: { show: false, text: "" },
      },
    });
    const svg = renderImageSvg(document);
    expect(svg).toContain("5,755");
    expect(svg).toContain("Revenue");
    expect(normalizeGolden(svg)).toMatchSnapshot();
    const png = await renderImagePng(document);
    expect((await sharp(png).metadata()).format).toBe("png");
  });

  it.each(supportedPresets)("renders the %s preset as deterministic SVG and PNG", async (mark) => {
    const document = makeDocument(mark);
    const svg = renderImageSvg(document);
    const png = await renderImagePng(document);
    const metadata = await sharp(png).metadata();
    expect({
      mark,
      pngSha256: createHash("sha256").update(png).digest("hex"),
      svg: normalizeGolden(svg),
    }).toMatchSnapshot();
    expect(metadata).toEqual(expect.objectContaining({ format: "png", height: 720, width: 1280 }));
  });

  it("removes card content in chart-only layout", () => {
    const svg = renderImageSvg(makeDocument("line", { layout: "chartOnly" }));
    expect(svg).toContain('<rect width="1280" height="720" fill="#FFFFFF"/>');
    expect(svg).not.toContain('<rect width="1280" height="720" fill="#F4F4F5"/>');
    expect(svg).not.toContain("Visits in the last 30 days");
    expect(svg).not.toContain("IntelliTeam");
    expect(svg).not.toContain("Powered by");
  });

  it("places team and project names on the canvas, not the card", () => {
    const svg = renderImageSvg(makeDocument("line"));
    expect(svg).toContain("IntelliTeam");
    expect(svg).toContain("Chart factory");
    expect(svg).toContain("Visits in the last 30 days");
  });

  it("applies a gradient only behind the themed card", () => {
    const svg = renderImageSvg(makeDocument("line", {
      background: { from: "#103751", mode: "gradient", to: "#1A7FA0" },
      theme: "light",
    }));
    expect(svg).toContain("url(#cb-canvas-bg)");
    expect(svg).toContain('stop-color="#103751"');
    expect(svg).toContain('stop-color="#1A7FA0"');
    expect(svg).toContain('fill="#FFFFFF"/>');
  });

  it("applies a custom color only behind the themed card", () => {
    const svg = renderImageSvg(makeDocument("line", {
      background: { color: "#E8DCC8", mode: "custom" },
      theme: "light",
    }));
    expect(svg).toContain('<rect width="1280" height="720" fill="#E8DCC8"/>');
    expect(svg).toContain('fill="#FFFFFF"/>');
    expect(svg).toContain("fill=\"#18181B\"");
  });

  it("keeps dark card colors when a light custom background is set", () => {
    const svg = renderImageSvg(makeDocument("line", {
      background: { color: "#E8DCC8", mode: "custom" },
      theme: "dark",
    }));
    expect(svg).toContain('<rect width="1280" height="720" fill="#E8DCC8"/>');
    expect(svg).toContain('fill="#18181B"/>');
    expect(svg).not.toContain('<rect width="1280" height="720" fill="#09090B"/>');
  });

  it("keeps a themed chart panel in chart-only layout with a custom background", () => {
    const svg = renderImageSvg(makeDocument("line", {
      background: { color: "#E8DCC8", mode: "custom" },
      layout: "chartOnly",
    }));
    expect(svg).toContain('<rect width="1280" height="720" fill="#E8DCC8"/>');
    expect(svg).toContain('fill="#FFFFFF"/>');
    expect(svg).not.toContain("Visits in the last 30 days");
  });

  it("escapes user text", () => {
    const document = makeDocument("kpi");
    document.content.title.text = "Revenue <script>alert(1)</script>";
    const svg = renderImageSvg(document);
    expect(svg).toContain("Revenue &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(svg).not.toContain("<script>alert(1)</script>");
  });

  it("embeds only a bounded safe project logo", () => {
    const safeLogo = Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"8\" height=\"8\"/></svg>")
      .toString("base64");
    const document = makeDocument("kpi");
    document.content.logo = true;
    document.metadata.logoDataUri = `data:image/svg+xml;base64,${safeLogo}`;
    expect(renderImageSvg(document)).toContain(document.metadata.logoDataUri);

    const unsafeLogo = Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"><image href=\"https://example.com/logo.png\"/></svg>")
      .toString("base64");
    document.metadata.logoDataUri = `data:image/svg+xml;base64,${unsafeLogo}`;
    expect(() => renderImageSvg(document)).toThrow("Project logo data is invalid");
  });

  it("rejects documents beyond the fixed render limits", () => {
    expect(() => renderImageSvg(makeDocument("kpi", { width: 2401 })))
      .toThrow("Image dimensions exceed the maximum size");

    const document = makeDocument("kpi");
    document.preparedData.results[0].rows = Array.from({ length: 20_001 }, () => ({
      seriesId: "series-1111111111111111",
      value: 1,
    }));
    expect(() => renderImageSvg(document)).toThrow("Prepared data exceeds the image row limit");
  });
});

describe("render worker queue", () => {
  it("renders PNG in the isolated worker", async () => {
    const queue = new RenderWorkerQueue();
    try {
      const png = await queue.render(makeDocument("kpi"));
      expect([...png.subarray(0, 4)]).toEqual([137, 80, 78, 71]);
    } finally {
      await queue.close();
    }
  });

  it("replaces a worker after the fixed deadline", async () => {
    const queue = new RenderWorkerQueue({
      renderTimeoutMs: 25,
      workerFile: path.join(__dirname, "../fixtures/hangingRenderWorker.js"),
    });
    try {
      await expect(queue.render({ hang: true })).rejects.toMatchObject({
        code: "IMAGE_RENDER_TIMEOUT",
      });
      await expect(queue.render({ hang: false })).resolves.toEqual(Buffer.from([137, 80, 78, 71]));
    } finally {
      await queue.close();
    }
  });

  it("removes aborted work that is waiting in the queue", async () => {
    const queue = new RenderWorkerQueue({
      renderTimeoutMs: 25,
      workerFile: path.join(__dirname, "../fixtures/hangingRenderWorker.js"),
    });
    try {
      const active = queue.render({ hang: true });
      const controller = new AbortController();
      const queued = queue.render({ hang: false }, { signal: controller.signal });
      controller.abort();
      await expect(queued).rejects.toMatchObject({ code: "IMAGE_RENDER_ABORTED" });
      await expect(active).rejects.toMatchObject({ code: "IMAGE_RENDER_TIMEOUT" });
    } finally {
      await queue.close();
    }
  });
});
