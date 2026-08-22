const path = require("path");
const { chromium } = require("playwright");

const { buildEChartsOption } = require("../../visualization/compilers/echarts");

const PRESETS = ["line", "area", "bar", "pie", "doughnut", "radar", "polar", "matrix", "gauge"];
const SIZES = [
  { height: 150, width: 500 },
  { height: 160, width: 240 },
  { height: 200, width: 600 },
  { height: 300, width: 800 },
  { height: 630, width: 1200 },
];
const SERIES_ID = "series-1111111111111111";

function fieldsForPreset(preset) {
  if (preset === "gauge") {
    return [{ key: "value", role: "measure", type: "quantitative" }];
  }
  if (preset === "matrix") {
    return [
      { key: "time", role: "dimension", type: "temporal" },
      { key: "value", role: "measure", type: "quantitative" },
    ];
  }
  return [
    { key: "category", role: "dimension", type: "nominal" },
    { key: "value", role: "measure", type: "quantitative" },
  ];
}

function rowsForPreset(preset) {
  if (preset === "gauge") return [{ seriesId: SERIES_ID, value: 72 }];
  if (preset === "matrix") {
    return [
      { seriesId: SERIES_ID, time: "2026-08-19T00:00:00.000Z", value: 4 },
      { seriesId: SERIES_ID, time: "2026-08-20T00:00:00.000Z", value: 9 },
    ];
  }
  return [
    { category: "Jan", seriesId: SERIES_ID, value: 10 },
    { category: "Feb", seriesId: SERIES_ID, value: 20 },
  ];
}

function encodingForPreset(preset) {
  if (preset === "gauge") {
    return { value: { field: "root[].value", type: "quantitative" } };
  }
  if (preset === "matrix") {
    return {
      time: { field: "root[].time", type: "temporal" },
      value: { field: "root[].value", type: "quantitative" },
    };
  }
  return {
    category: { field: "root[].category", type: "nominal" },
    value: { field: "root[].value", type: "quantitative" },
  };
}

function buildFixture(preset) {
  const rows = rowsForPreset(preset);
  const series = [{ id: SERIES_ID, key: "string:__default__", label: "Revenue", value: null }];
  return {
    preparedData: {
      frameVersion: 1,
      generatedAt: "2026-08-20T00:00:00.000Z",
      identityVersion: 1,
      resource: { id: 42, kind: "chart" },
      results: [{
        availableSeries: series,
        bindingId: "binding-1",
        fields: fieldsForPreset(preset),
        id: "layer-1",
        mark: preset,
        name: "Revenue",
        rows,
        series,
        stats: { inputRows: rows.length, outputRows: rows.length },
        warnings: [],
      }],
      stats: { inputRows: rows.length, outputRows: rows.length },
      timezone: "UTC",
      version: 1,
      warnings: [],
    },
    visualization: {
      version: 2,
      status: "ready",
      layers: [{
        bindingId: "binding-1",
        encoding: encodingForPreset(preset),
        id: "layer-1",
        mark: preset,
        name: "Revenue",
        orientation: "vertical",
        stack: "none",
        style: { color: "#048BDE", fill: preset === "area" },
        transforms: [],
      }],
      settings: {
        dataLabels: true,
        legend: { visible: true },
        ranges: [{ color: "#22c55e", label: "Value", max: 100, min: 0 }],
      },
    },
  };
}

function buildCartesianFixture(preset = "line", pointCount = 30) {
  const fixture = buildFixture(preset);
  fixture.preparedData.results[0].rows = Array.from({ length: pointCount }, (_, index) => ({
    category: `Day ${index + 1}`,
    seriesId: SERIES_ID,
    value: 100 + ((index * 17) % 90),
  }));
  fixture.preparedData.results[0].stats = {
    inputRows: pointCount,
    outputRows: pointCount,
  };
  fixture.preparedData.stats = { inputRows: pointCount, outputRows: pointCount };
  return fixture;
}

describe("ECharts fixed-size browser rendering", () => {
  let browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser?.close();
  });

  it.each(PRESETS)("renders %s at compact, dashboard, and export sizes", async (preset) => {
    for (const size of SIZES) {
      const page = await browser.newPage({ viewport: size });
      const option = buildEChartsOption({
        ...buildFixture(preset),
        renderContext: { ...size, surface: size.width === 1200 ? "export" : "dashboard" },
      });
      await page.setContent("<div id=\"chart\" style=\"height:100vh;width:100vw\"></div>");
      await page.addScriptTag({
        path: path.resolve(__dirname, "../../../client/node_modules/echarts/dist/echarts.min.js"),
      });
      const rendered = await page.evaluate((chartOption) => {
        const element = document.getElementById("chart");
        const chart = window.echarts.init(element, null, { renderer: "canvas" });
        chart.setOption(chartOption, { notMerge: true });
        chart.resize();
        const current = chart.getOption();
        const gauge = current.series.find((series) => series.type === "gauge");
        const seriesModel = chart.getModel().getSeriesByIndex(0);
        const symbol = current.series[0]?.symbol;
        const isMatrix = (Array.isArray(symbol) ? symbol[0] : symbol) === "roundRect";
        const data = seriesModel.getData();
        const matrixEl = isMatrix ? data.getItemGraphicEl(0)?.childAt?.(0) : null;
        const symbolSize = current.series[0]?.symbolSize;
        const matrixFills = isMatrix
          ? Array.from({ length: data.count() }, (_, index) => {
            return data.getItemGraphicEl(index)?.childAt?.(0)?.style?.fill || null;
          })
          : [];
        const result = {
          ariaLabel: chart.getDom().getAttribute("aria-label"),
          gaugeCenter: gauge?.center,
          gaugeDetailShow: gauge?.detail?.show,
          height: chart.getHeight(),
          matrixFills,
          matrixScale: matrixEl ? {
            x: matrixEl.scaleX,
            y: matrixEl.scaleY,
          } : null,
          matrixSymbolSize: Array.isArray(symbolSize) ? symbolSize : [symbolSize, symbolSize],
          titleText: current.title?.[0]?.text,
          seriesIds: current.series.map((series) => series.id),
          width: chart.getWidth(),
        };
        chart.dispose();
        return result;
      }, option);

      expect(rendered.width).toBe(size.width);
      expect(rendered.height).toBe(size.height);
      expect(rendered.seriesIds).toContain(SERIES_ID);
      expect(rendered.ariaLabel).toBeTruthy();
      if (preset === "matrix") {
        expect(rendered.matrixScale.x).toBe(rendered.matrixScale.y);
        expect(rendered.matrixSymbolSize[0]).toBe(rendered.matrixSymbolSize[1]);
        expect(rendered.matrixSymbolSize[0]).toBeGreaterThan(0);
        expect(new Set(rendered.matrixFills.filter(Boolean)).size).toBeGreaterThan(1);
      }
      const isSmallestWideGauge = preset === "gauge" && size.height <= 160 && size.width >= 420;
      let expectedGauge = {};
      if (isSmallestWideGauge) expectedGauge = {
        gaugeCenter: ["72%", "52%"],
        gaugeDetailShow: false,
        titleText: "72",
      };
      else if (preset === "gauge" && size.width > 320) expectedGauge = {
        gaugeCenter: ["50%", "55%"],
      };
      expect(rendered).toMatchObject(expectedGauge);
      await page.close();
    }
  }, 30000);

  it.each([
    { composition: "sparkline", height: 104, preset: "line", width: 189 },
    { composition: "sparkline", height: 80, preset: "line", width: 424 },
    { composition: "limited", height: 231, preset: "line", width: 424 },
    { composition: "analysis", height: 300, preset: "line", width: 800 },
    { composition: "sparkline", height: 104, preset: "bar", width: 189 },
    { composition: "sparkline", height: 80, preset: "bar", width: 424 },
    { composition: "limited", height: 231, preset: "bar", width: 424 },
    { composition: "analysis", height: 300, preset: "bar", width: 800 },
  ])("renders the $preset $composition composition at $width x $height", async ({
    composition, height, preset, width,
  }) => {
    const page = await browser.newPage({ viewport: { height, width } });
    const option = buildEChartsOption({
      ...buildCartesianFixture(preset),
      renderContext: { height, surface: "dashboard", width },
    });
    await page.setContent("<div id=\"chart\" style=\"height:100vh;width:100vw\"></div>");
    await page.addScriptTag({
      path: path.resolve(__dirname, "../../../client/node_modules/echarts/dist/echarts.min.js"),
    });
    const rendered = await page.evaluate((chartOption) => {
      const chart = window.echarts.init(document.getElementById("chart"), null, { renderer: "canvas" });
      chart.setOption(chartOption, { notMerge: true });
      chart.resize();
      const current = chart.getOption();
      const result = {
        containLabel: current.grid[0].containLabel,
        legend: current.legend[0].show,
        seriesLabel: current.series[0].label.show,
        showSymbol: current.series[0].showSymbol,
        xAxis: current.xAxis[0].show,
        xInterval: current.xAxis[0].axisLabel.interval,
        yAxis: current.yAxis[0].show,
      };
      chart.dispose();
      return result;
    }, option);

    if (composition === "sparkline") {
      expect(rendered).toMatchObject({
        containLabel: false,
        legend: false,
        seriesLabel: false,
        showSymbol: false,
        xAxis: false,
        yAxis: false,
      });
    } else if (composition === "limited") {
      expect(rendered).toMatchObject({
        containLabel: true,
        legend: true,
        seriesLabel: false,
        showSymbol: false,
        xAxis: true,
        xInterval: 5,
        yAxis: true,
      });
    } else {
      expect(rendered).toMatchObject({
        containLabel: true,
        legend: true,
        seriesLabel: true,
        xAxis: true,
        yAxis: true,
      });
    }
    await page.close();
  }, 30000);
});
