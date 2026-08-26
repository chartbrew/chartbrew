const path = require("path");
const { createHash } = require("crypto");
const sharp = require("sharp");

const { resolveImageSize } = require("../../../shared/visualization/imageLayout");
const { renderImagePng, renderImageSvg } = require("../../modules/chartImage/imageRenderer");
const { RenderWorkerQueue } = require("../../modules/chartImage/renderWorkerQueue");

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
    height: 630,
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
    width: 1200,
    ...overrides,
  };
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
    expect(resolveImageSize({ preset: "social" })).toEqual({ height: 630, width: 1200 });
    expect(resolveImageSize({ preset: "square" })).toEqual({ height: 1080, width: 1080 });
    expect(resolveImageSize({ preset: "original", sourceHeight: 200, sourceWidth: 400 }))
      .toEqual({ height: 480, width: 960 });
  });

  it("renders a deterministic line share card SVG and PNG", async () => {
    const document = makeDocument("line");
    const first = renderImageSvg(document);
    const second = renderImageSvg(document);
    expect(first).toBe(second);
    expect(first).toContain("Visits in the last 30 days");
    expect(first).toContain("Made with Chartbrew");
    expect(first).not.toContain("font-family:Inter, sans-serif");
    expect(first).not.toMatch(/<script|<foreignObject/i);
    expect(normalizeGolden(first)).toMatchSnapshot();

    const png = await renderImagePng(document);
    const metadata = await sharp(png).metadata();
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(metadata).toEqual(expect.objectContaining({ format: "png", height: 630, width: 1200 }));
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
    expect(metadata).toEqual(expect.objectContaining({ format: "png", height: 630, width: 1200 }));
  });

  it("removes card content in chart-only layout", () => {
    const svg = renderImageSvg(makeDocument("line", { layout: "chartOnly" }));
    expect(svg).not.toContain("Visits in the last 30 days");
    expect(svg).not.toContain("IntelliTeam");
    expect(svg).not.toContain("Made with Chartbrew");
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
