const path = require("path");
const { chromium } = require("playwright");

const { buildEChartsOption } = require("../../visualization/compilers/echarts");

const PRESETS = [
  "line", "bar", "horizontalBar", "pie", "doughnut", "radar", "polar", "matrix", "gauge",
];
const SIZES = [
  { height: 80, surface: "dashboard", width: 189 },
  { height: 104, surface: "editor", width: 189 },
  { height: 231, surface: "embed", width: 189 },
  { height: 231, surface: "dashboard", width: 307 },
  { height: 80, surface: "editor", width: 424 },
  { height: 104, surface: "embed", width: 424 },
  { height: 173, surface: "dashboard", width: 424 },
  { height: 231, surface: "editor", width: 424 },
  { height: 335, surface: "embed", width: 424 },
  { height: 630, surface: "export", width: 1200 },
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
        orientation: preset === "horizontalBar" ? "horizontal" : "vertical",
        stack: "none",
        style: { color: "#048BDE", fill: false },
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

  it.each(PRESETS)("renders %s at every required fixed size and surface", async (preset) => {
    for (const size of SIZES) {
      const page = await browser.newPage({ viewport: { height: size.height, width: size.width } });
      const option = buildEChartsOption({
        ...buildFixture(preset),
        renderContext: size,
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
          titleShow: current.title?.[0]?.show,
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
      let expectedGauge = {};
      if (preset === "gauge" && size.height <= 160 && size.width >= 260) expectedGauge = {
        gaugeCenter: ["72%", "50%"],
        gaugeDetailShow: false,
        titleText: "{value|72} {marker|●}\n{label|Revenue}",
      };
      else if (preset === "gauge" && size.width <= 259 && size.height <= 149) expectedGauge = {
        gaugeCenter: ["50%", "55%"],
        gaugeDetailShow: false,
        titleShow: false,
      };
      else if (preset === "gauge" && size.width <= 259) expectedGauge = {
        gaugeCenter: ["50%", "70%"],
        gaugeDetailShow: false,
        titleText: "{value|72} {marker|●}\n{label|Revenue}",
      };
      else if (preset === "gauge") expectedGauge = {
        gaugeCenter: ["50%", "55%"],
        gaugeDetailShow: false,
        titleText: "{value|72} {marker|●}\n{label|Revenue}",
      };
      expect(rendered).toMatchObject(expectedGauge);
      await page.close();
    }
  }, 30000);

  it.each([
    { center: ["50%", "55%"], composition: "micro", height: 104, titleShow: false, width: 189 },
    { center: ["72%", "50%"], composition: "side-summary", fontSize: 28, height: 104, left: "8%", titleShow: true, width: 424 },
    { center: ["50%", "70%"], composition: "compact", fontSize: 22, height: 231, left: "50%", titleShow: true, width: 189 },
    { center: ["50%", "55%"], composition: "centered", fontSize: 32, height: 231, left: "50%", titleShow: true, width: 424 },
    { center: ["50%", "55%"], composition: "large", fontSize: 42, height: 300, left: "50%", titleShow: true, width: 800 },
  ])("renders the gauge $composition composition at $width x $height", async ({
    center, fontSize, height, left, titleShow, width,
  }) => {
    const page = await browser.newPage({ viewport: { height, width } });
    const option = buildEChartsOption({
      ...buildFixture("gauge"),
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
      const gauge = current.series.find((series) => series.type === "gauge");
      const title = current.title[0];
      const result = {
        center: gauge.center,
        detail: gauge.detail.show,
        labelColor: title.textStyle.rich.label.color,
        left: title.left,
        markerColor: title.textStyle.rich.marker.color,
        titleShow: title.show,
        valueFontSize: title.textStyle.rich.value.fontSize,
      };
      chart.dispose();
      return result;
    }, option);

    expect(rendered).toMatchObject({
      center,
      detail: false,
      titleShow,
      ...(titleShow ? {
        labelColor: "#71717a",
        left,
        markerColor: "#22c55e",
        valueFontSize: fontSize,
      } : {}),
    });
    await page.close();
  }, 30000);

  it("renders the final line segment with a dashed stroke", async () => {
    const page = await browser.newPage({ viewport: { height: 300, width: 800 } });
    const fixture = buildCartesianFixture("line", 4);
    fixture.visualization.settings.dashedLastPoint = true;
    const option = buildEChartsOption({
      ...fixture,
      renderContext: { height: 300, surface: "dashboard", width: 800 },
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
      const result = current.series.map((series) => ({
        data: series.data,
        id: series.id,
        lineType: series.lineStyle?.type,
        type: series.type,
      }));
      chart.dispose();
      return result;
    }, option);

    expect(rendered).toEqual(expect.arrayContaining([
      expect.objectContaining({
        data: [null, null, 134, 151],
        id: `${SERIES_ID}--dashed-last`,
        lineType: [5, 10],
        type: "line",
      }),
      expect.objectContaining({
        data: [null, null, null, 151],
        id: `${SERIES_ID}--latest-point`,
        type: "scatter",
      }),
    ]));
    await page.close();
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

  it.each([
    { composition: "dense", height: 104, showAxes: false, width: 424 },
    { composition: "dense", height: 231, showAxes: false, width: 189 },
    { composition: "bounded", height: 231, showAxes: true, width: 424 },
    { composition: "labeled", height: 400, showAxes: true, width: 800 },
  ])("renders the matrix $composition composition at $width x $height", async ({
    height, showAxes, width,
  }) => {
    const page = await browser.newPage({ viewport: { height, width } });
    const option = buildEChartsOption({
      ...buildFixture("matrix"),
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
        symbolSize: current.series[0].symbolSize,
        xAxis: current.xAxis[0].show,
        yAxis: current.yAxis[0].show,
      };
      chart.dispose();
      return result;
    }, option);

    expect(rendered).toMatchObject({ xAxis: showAxes, yAxis: showAxes });
    expect(rendered.symbolSize).toBeGreaterThan(0);
    await page.close();
  }, 30000);

  it.each([
    { center: ["50%", "50%"], composition: "micro", height: 104, title: false, width: 189 },
    { center: ["73%", "50%"], composition: "side-summary", height: 104, title: true, width: 424 },
    { center: ["50%", "69%"], composition: "stacked-summary", height: 231, title: true, width: 189 },
    { center: ["50%", "50%"], composition: "centered", height: 231, title: null, width: 424 },
    { center: ["75%", "50%"], composition: "side-breakdown", height: 300, title: null, width: 800 },
    { center: ["50%", "27%"], composition: "stacked-breakdown", height: 400, title: null, width: 424 },
  ])("renders pie and doughnut $composition at $width x $height", async ({
    center, composition, height, title, width,
  }) => {
    for (const preset of ["pie", "doughnut"]) {
      const page = await browser.newPage({ viewport: { height, width } });
      const option = buildEChartsOption({
        ...buildFixture(preset),
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
          center: current.series[0].center,
          label: current.series[0].label.show,
          legend: current.legend[0].show,
          title: current.title[0].show,
        };
        chart.dispose();
        return result;
      }, option);

      const expected = composition === "centered"
        ? { center, label: true, title: preset === "doughnut" }
        : {
          center,
          label: !["micro", "side-summary", "stacked-summary"].includes(composition),
          legend: false,
          title: title ?? preset === "doughnut",
        };
      expect(rendered).toMatchObject(expected);
      await page.close();
    }
  }, 30000);
});
