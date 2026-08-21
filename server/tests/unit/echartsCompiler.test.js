const clientPresetImplementations = require("../../../client/src/visualization/presetImplementations.json");
const { VisualizationEngine } = require("../../visualization/VisualizationEngine");
const { buildEChartsOption } = require("../../visualization/compilers/echarts");
const { PRESET_MANIFEST, getReadyPresets } = require("../../visualization/registry");
const { SERVER_PRESET_IMPLEMENTATIONS } = require("../../visualization/presetImplementations");

function field(key, role = "dimension", type = "nominal") {
  return { key, role, sourceField: `root[].${key}`, type };
}

function makeVisualization(mark, encoding, options = {}) {
  return {
    version: 2,
    status: "ready",
    layers: [{
      bindingId: "binding-1",
      encoding,
      goal: options.goal ?? null,
      id: "layer-1",
      mark,
      name: options.name || "Revenue",
      orientation: options.orientation || "vertical",
      stack: options.stack || "none",
      style: {
        color: "#048BDE",
        fill: mark === "area",
        fillOpacity: 0.2,
      },
      transforms: [],
    }],
    settings: {
      dataLabels: true,
      legend: { visible: true },
      missingValues: { policy: "preserve" },
      ranges: options.ranges,
    },
  };
}

function makePrepared(mark, fields, rows, series) {
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
      rows,
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

const defaultSeries = [{
  id: "series-1111111111111111",
  key: "string:__default__",
  label: "Revenue",
  value: null,
}];

function buildFixture(mark) {
  if (["area", "bar", "line"].includes(mark)) {
    return {
      preparedData: makePrepared(
        mark,
        [field("category"), field("value", "measure", "quantitative")],
        [
          { category: "Jan", seriesId: defaultSeries[0].id, value: 10 },
          { category: "Feb", seriesId: defaultSeries[0].id, value: null },
          { category: "Mar", seriesId: defaultSeries[0].id, value: 30 },
        ],
        defaultSeries
      ),
      visualization: makeVisualization(mark, {
        category: { field: "root[].month", type: "nominal" },
        value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
      }, { goal: 25 }),
    };
  }

  if (["doughnut", "pie", "polar"].includes(mark)) {
    return {
      preparedData: makePrepared(
        mark,
        [field("category"), field("value", "measure", "quantitative")],
        [
          { category: "Pro", seriesId: defaultSeries[0].id, value: 70 },
          { category: "Free", seriesId: defaultSeries[0].id, value: 30 },
        ],
        defaultSeries
      ),
      visualization: makeVisualization(mark, {
        category: { field: "root[].plan", type: "nominal" },
        value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
      }),
    };
  }

  if (mark === "radar") {
    const series = [{
      id: "series-2222222222222222",
      key: "string:Pro",
      label: "Pro",
      value: "Pro",
    }, {
      id: "series-3333333333333333",
      key: "string:Free",
      label: "Free",
      value: "Free",
    }];
    return {
      preparedData: makePrepared(
        mark,
        [field("category"), field("value", "measure", "quantitative"), field("breakdown")],
        [
          { breakdown: "Pro", category: "Speed", seriesId: series[0].id, value: 8 },
          { breakdown: "Pro", category: "Quality", seriesId: series[0].id, value: 9 },
          { breakdown: "Free", category: "Speed", seriesId: series[1].id, value: 5 },
          { breakdown: "Free", category: "Quality", seriesId: series[1].id, value: 6 },
        ],
        series
      ),
      visualization: makeVisualization(mark, {
        breakdown: { field: "root[].plan", type: "nominal" },
        category: { field: "root[].metric", type: "nominal" },
        value: { aggregate: "sum", field: "root[].score", type: "quantitative" },
      }),
    };
  }

  if (mark === "matrix") {
    return {
      preparedData: makePrepared(
        mark,
        [field("time", "dimension", "temporal"), field("value", "measure", "quantitative")],
        [
          { seriesId: defaultSeries[0].id, time: "2026-08-19T00:00:00.000Z", value: 4 },
          { seriesId: defaultSeries[0].id, time: "2026-08-20T00:00:00.000Z", value: 9 },
        ],
        defaultSeries
      ),
      visualization: makeVisualization(mark, {
        time: { field: "root[].date", type: "temporal" },
        value: { aggregate: "sum", field: "root[].count", type: "quantitative" },
      }),
    };
  }

  return {
    preparedData: makePrepared(
      "gauge",
      [field("value", "measure", "quantitative")],
      [{ seriesId: defaultSeries[0].id, value: 72 }],
      defaultSeries
    ),
    visualization: makeVisualization("gauge", {
      value: { aggregate: "sum", field: "root[].score", type: "quantitative" },
    }, {
      ranges: [
        { color: "#22c55e", label: "Good", max: 80, min: 0 },
        { color: "#ef4444", label: "High", max: 100, min: 80 },
      ],
    }),
  };
}

function getOptionValues(mark, option) {
  if (["area", "bar", "line", "polar"].includes(mark)) {
    return option.dataset.source.map((row) => row.slice(1));
  }
  if (["doughnut", "pie"].includes(mark)) {
    return option.dataset[0].source.map((row) => row.value);
  }
  if (mark === "radar") return option.series.map((series) => series.data[0].value);
  if (mark === "matrix") return option.dataset[0].source.map((row) => row.value);
  return [option.series.find((series) => series.type === "gauge").data[0].value];
}

function getEChartsSeriesValues(mark, option) {
  if (["area", "bar", "line", "polar"].includes(mark)) {
    const source = option.dataset.source;
    return option.series.map((series, seriesIndex) => {
      return source.map((row) => row[seriesIndex + 1]);
    });
  }
  if (["doughnut", "pie"].includes(mark)) {
    return option.dataset.map((dataset) => dataset.source.map((row) => row.value));
  }
  if (mark === "radar") return option.series.map((series) => series.data[0].value);
  if (mark === "matrix") return option.dataset.map((dataset) => dataset.source.map((row) => row.value));
  return [[option.series.find((series) => series.type === "gauge").data[0].value]];
}

function getChartJsSeriesValues(mark, configuration) {
  if (mark === "matrix") {
    return configuration.data.datasets.map((dataset) => dataset.data.map((row) => row.v));
  }
  return configuration.data.datasets.map((dataset) => dataset.data);
}

describe("ECharts compiler", () => {
  const graphicalPresets = [
    "line", "area", "bar", "pie", "doughnut", "radar", "polar", "matrix", "gauge",
  ];

  it.each(graphicalPresets)("builds deterministic JSON for %s", (mark) => {
    const fixture = buildFixture(mark);
    const first = buildEChartsOption({
      ...fixture,
      renderContext: { height: 300, surface: "editor", width: 480 },
    });
    const second = buildEChartsOption({
      ...fixture,
      renderContext: { height: 300, surface: "editor", width: 480 },
    });

    expect(first).toEqual(JSON.parse(JSON.stringify(first)));
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.series.every((series) => typeof series.id === "string")).toBe(true);
    expect(getOptionValues(mark, first)).toMatchSnapshot();
  });

  it("formats pie and doughnut value labels from the numeric value field", () => {
    ["pie", "doughnut"].forEach((mark) => {
      const fixture = buildFixture(mark);
      fixture.visualization.settings.dataLabelsFormat = "value";
      const option = buildEChartsOption(fixture);

      expect(option.series[0].label.formatter).toBe("{@value}");
      expect(option.series[0].label.formatter).not.toContain("{c}");
    });
  });

  it("rounds and separates doughnut segments and centers the total", () => {
    const option = buildEChartsOption(buildFixture("doughnut"));

    expect(option.series[0].itemStyle.borderRadius).toBe(6);
    expect(option.series[0].padAngle).toBe(2);
    expect(option.series[0].center).toEqual(["50%", "50%"]);
    expect(option.title).toMatchObject({
      left: "50%",
      textAlign: "center",
      textVerticalAlign: "middle",
      top: "50%",
    });
    expect(option.title.textStyle.rich).toMatchObject({
      label: { fontSize: 10, fontWeight: 400, lineHeight: 15 },
      percent: {
        fontFamily: "Inter Tight, sans-serif",
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 16,
      },
      value: {
        fontFamily: "Inter Tight, sans-serif",
        fontSize: 26,
        fontWeight: 700,
        lineHeight: 31,
      },
    });
  });

  it("hides doughnut legend and labels in tight layouts and keeps a smaller total", () => {
    const option = buildEChartsOption(buildFixture("doughnut"));
    const tight = option.media.find((media) => media.query.maxHeight === 220);

    expect(option.media).toEqual(expect.arrayContaining([
      expect.objectContaining({ query: { maxHeight: 220 } }),
      expect.objectContaining({ query: { maxWidth: 320 } }),
    ]));
    expect(tight.option.legend).toEqual({ show: false });
    expect(tight.option.series).toEqual([{ label: { show: false } }]);
    expect(tight.option.title.text).toBe("{value|100}");
    expect(tight.option.title.text).not.toMatch(/Total/);
    expect(tight.option.title.textStyle.rich.value).toMatchObject({
      fontFamily: "Inter Tight, sans-serif",
      fontSize: 16,
      fontWeight: 700,
    });
  });

  it("preserves nulls, row order, goal, and stable series identity", () => {
    const fixture = buildFixture("line");
    const option = buildEChartsOption(fixture);

    expect(option.dataset.source).toEqual([
      ["Jan", 10],
      ["Feb", null],
      ["Mar", 30],
    ]);
    expect(option.series[0].id).toBe(defaultSeries[0].id);
    expect(option.series[0].markLine.data[0].yAxis).toBe(25);
  });

  it("shows horizontal bar categories in the prepared sort order from top to bottom", () => {
    const fixture = buildFixture("bar");
    fixture.visualization.layers[0].orientation = "horizontal";
    fixture.preparedData.results[0].rows = [
      { category: "High", seriesId: defaultSeries[0].id, value: 30 },
      { category: "Medium", seriesId: defaultSeries[0].id, value: 20 },
      { category: "Low", seriesId: defaultSeries[0].id, value: 10 },
    ];

    const option = buildEChartsOption(fixture);

    expect(option.dataset.source.map((row) => row[0])).toEqual(["High", "Medium", "Low"]);
    expect(option.yAxis.inverse).toBe(true);
  });

  it("keeps ECharts series IDs stable when source rows are reordered", () => {
    const fixture = buildFixture("line");
    const reordered = {
      ...fixture,
      preparedData: {
        ...fixture.preparedData,
        results: fixture.preparedData.results.map((result) => ({
          ...result,
          rows: [...result.rows].reverse(),
        })),
      },
    };

    expect(buildEChartsOption(fixture).series.map((series) => series.id))
      .toEqual(buildEChartsOption(reordered).series.map((series) => series.id));
  });

  it("contains responsive fixed-size rules and reduced-motion support", () => {
    const fixture = buildFixture("bar");
    const option = buildEChartsOption({
      ...fixture,
      renderContext: {
        height: 160,
        reducedMotion: true,
        surface: "embed",
        width: 240,
      },
    });

    expect(option.animation).toBe(false);
    expect(option.media).toEqual(expect.arrayContaining([
      expect.objectContaining({ query: { maxHeight: 220 } }),
      expect.objectContaining({ query: { maxWidth: 320 } }),
    ]));
    expect(option.aria.enabled).toBe(true);
    expect(option.aria.decal.show).toBe(false);
  });

  it("builds a calendar-style matrix with weekday rows and filled missing dates", () => {
    const fixture = buildFixture("matrix");
    fixture.preparedData.results[0].rows = [
      { seriesId: defaultSeries[0].id, time: "2026-08-17T00:00:00.000Z", value: 4 },
      { seriesId: defaultSeries[0].id, time: "2026-08-19T00:00:00.000Z", value: 9 },
    ];
    const option = buildEChartsOption(fixture);

    expect(option.xAxis.data).toEqual(["Aug 17"]);
    expect(option.yAxis.data).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(option.dataset[0].source.map((row) => row.value)).toEqual([4, 0, 9]);
    expect(option.visualMap.show).toBe(false);
  });

  it("sizes matrix cells as squares and keeps gutters out of compact media", () => {
    const fixture = buildFixture("matrix");
    fixture.preparedData.results[0].rows = [
      { seriesId: defaultSeries[0].id, time: "2026-02-16T00:00:00.000Z", value: 1 },
      { seriesId: defaultSeries[0].id, time: "2026-08-03T00:00:00.000Z", value: 2 },
    ];
    const option = buildEChartsOption({
      ...fixture,
      renderContext: { height: 200, surface: "dashboard", width: 800 },
    });
    const columns = option.xAxis.data.length;
    const rows = option.yAxis.data.length;
    const cellSize = option.grid.width / columns;

    expect(rows).toBe(7);
    expect(columns).toBeGreaterThan(10);
    expect(cellSize).toBe(option.grid.height / rows);
    expect(option.grid.containLabel).toBe(false);
    expect(option.grid.left).toBeGreaterThan(8);
    expect(option.grid.top).toBeGreaterThanOrEqual(12);
    const rightSpace = 800 - option.grid.left - option.grid.width;
    const bottomSpace = 200 - option.grid.top - option.grid.height;
    expect(Math.abs((option.grid.left - 8) - (rightSpace - 40))).toBeLessThanOrEqual(1);
    expect(Math.abs((option.grid.top - 12) - (bottomSpace - 24))).toBeLessThanOrEqual(1);
    expect(option.series[0]).toMatchObject({
      symbol: "roundRect",
      symbolKeepAspect: true,
      symbolSize: cellSize - 3,
      type: "scatter",
    });
    expect(option.media).toBeUndefined();
  });

  it("keeps categorical row and column matrices supported", () => {
    const fixture = buildFixture("matrix");
    fixture.preparedData.results[0].fields = [
      field("column"),
      field("row"),
      field("value", "measure", "quantitative"),
    ];
    fixture.preparedData.results[0].rows = [
      { column: "Q1", row: "North", seriesId: defaultSeries[0].id, value: 4 },
      { column: "Q2", row: "South", seriesId: defaultSeries[0].id, value: 9 },
    ];
    const option = buildEChartsOption(fixture);

    expect(option.xAxis.data).toEqual(["Q1", "Q2"]);
    expect(option.yAxis.data).toEqual(["North", "South"]);
    expect(option.dataset[0].source.map((row) => row.value)).toEqual([4, 9]);
    expect(option.grid.width / option.xAxis.data.length)
      .toBe(option.grid.height / option.yAxis.data.length);
  });

  it("builds a segmented gauge without automotive ticks or numeric axis labels", () => {
    const option = buildEChartsOption(buildFixture("gauge"));
    const ranges = option.series.find((series) => series.type === "pie");
    const pointer = option.series.find((series) => series.type === "gauge");

    expect(ranges.data.map((range) => range.name)).toEqual(["Good", "High"]);
    expect(ranges.label.show).toBe(false);
    expect(ranges.radius).toEqual(["70%", "90%"]);
    expect(ranges.center).toEqual(["50%", "55%"]);
    expect(ranges.emphasis).toEqual({ label: { show: false }, scale: false });
    expect(ranges.tooltip).toEqual({ show: true });
    expect(pointer.axisLabel.show).toBe(false);
    expect(pointer.axisTick.show).toBe(false);
    expect(pointer.splitLine.show).toBe(false);
    expect(pointer.data[0].value).toBe(72);
    expect(pointer.detail).toMatchObject({
      fontFamily: "Inter Tight, sans-serif",
      fontWeight: 700,
      offsetCenter: [0, "0%"],
    });
    expect(pointer.pointer).toMatchObject({
      length: "50%",
      offsetCenter: [0, "-50%"],
    });
    expect(pointer.radius).toBe("90%");
    expect(pointer.title.offsetCenter).toEqual([0, "22%"]);
    expect(pointer.title.show).toBe(true);
    expect(pointer.tooltip.show).toBe(false);
  });

  it("moves the gauge value beside the gauge only in the smallest wide containers", () => {
    const option = buildEChartsOption(buildFixture("gauge"));
    const sideLayout = option.media.find((media) => media.query.minWidth === 420);
    const narrowLayout = option.media.find((media) => media.query.maxWidth === 320);

    expect(sideLayout.query).toEqual({ maxHeight: 160, minWidth: 420 });
    expect(sideLayout.option.title).toMatchObject({
      left: "10%",
      show: true,
      subtext: "Revenue",
      text: "72",
      top: "34%",
      textStyle: {
        fontFamily: "Inter Tight, sans-serif",
        fontWeight: 700,
      },
    });
    expect(sideLayout.option.series[0]).toMatchObject({
      center: ["72%", "52%"],
      radius: ["72%", "92%"],
    });
    expect(sideLayout.option.series[1].detail.show).toBe(false);
    expect(sideLayout.option.series[1].title.show).toBe(false);
    expect(narrowLayout.query).toEqual({ maxWidth: 320 });
    expect(narrowLayout.option.series[1].title.show).toBe(false);
    expect(narrowLayout.option.series[1].detail.show).not.toBe(false);
  });

  it("uses the chart gauge ranges when the stored visualization has no ranges", () => {
    const fixture = buildFixture("gauge");
    delete fixture.visualization.settings.ranges;
    const chart = {
      id: 42,
      name: "Churn rate",
      ranges: [
        { color: "#4385F5", label: "Great", max: 3, min: 0 },
        { color: "#FFB900", label: "Optimal", max: 8, min: 3 },
        { color: "#C00020", label: "Action required", max: 15, min: 8 },
      ],
      type: "gauge",
      visualization: fixture.visualization,
    };

    const compiled = new VisualizationEngine({
      chart,
      datasets: [],
      timezone: "UTC",
    }).renderPrepared(fixture.preparedData);
    const option = compiled.renderConfiguration;
    const ranges = option.series.find((series) => series.type === "pie");
    const pointer = option.series.find((series) => series.type === "gauge");

    expect(compiled.renderer).toBe("echarts");
    expect(ranges.data.map((range) => range.name)).toEqual([
      "Great", "Optimal", "Action required",
    ]);
    expect(ranges.data.map((range) => range.itemStyle.color)).toEqual([
      "#4385F5", "#FFB900", "#C00020",
    ]);
    expect(pointer.min).toBe(0);
    expect(pointer.max).toBe(15);
  });

  it.each(graphicalPresets)("matches Chart.js semantic values for %s", (mark) => {
    const fixture = buildFixture(mark);
    const compiled = new VisualizationEngine({
      chart: {
        id: 42,
        name: "Revenue",
        ranges: fixture.visualization.settings.ranges,
        type: mark,
        visualization: fixture.visualization,
      },
      datasets: [],
      timezone: "UTC",
    }).renderPrepared(fixture.preparedData);

    expect(compiled.renderer).toBe("echarts");
    expect(getEChartsSeriesValues(mark, compiled.renderConfiguration))
      .toEqual(getChartJsSeriesValues(mark, compiled.configuration));
  });
});

describe("preset registry contract", () => {
  it("has matching client and server implementations for every ready preset", () => {
    getReadyPresets().forEach((preset) => {
      expect(clientPresetImplementations[preset.id]).toBeTruthy();
      expect(SERVER_PRESET_IMPLEMENTATIONS[preset.id]).toBeTruthy();
      expect(SERVER_PRESET_IMPLEMENTATIONS[preset.id].renderer).toBe(preset.renderer);
    });
  });

  it("keeps the shared manifest serializable and versioned", () => {
    expect(PRESET_MANIFEST.version).toBe(1);
    expect(PRESET_MANIFEST).toEqual(JSON.parse(JSON.stringify(PRESET_MANIFEST)));
  });
});
