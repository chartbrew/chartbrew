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
        fill: options.fill ?? false,
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
  if (["bar", "horizontalBar", "line"].includes(mark)) {
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
  if (["bar", "horizontalBar", "line", "polar"].includes(mark)) {
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
  if (["bar", "horizontalBar", "line", "polar"].includes(mark)) {
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
    "line", "bar", "horizontalBar", "pie", "doughnut", "radar", "polar", "matrix", "gauge",
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
      label: { color: "#71717a", fontSize: 10, fontWeight: 400, lineHeight: 15 },
      percent: {
        color: "#71717a",
        fontFamily: "Inter Tight, sans-serif",
        fontSize: 11,
        fontWeight: 400,
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

  it("defines compact summary and large breakdown category layouts", () => {
    const option = buildEChartsOption(buildFixture("doughnut"));
    const micro = option.media.find((media) => media.query.maxWidth === 259
      && media.query.maxHeight === 149);
    const side = option.media.find((media) => media.query.minWidth === 260);
    const stacked = option.media.find((media) => media.query.minHeight === 150);
    const sideBreakdown = option.media.find((media) => media.query.minWidth === 520);
    const stackedBreakdown = option.media.find((media) => media.query.minHeight === 320);

    expect(micro.option).toMatchObject({
      legend: { show: false },
      series: [{ center: ["50%", "50%"], label: { show: false }, radius: ["52%", "90%"] }],
      title: { show: false },
    });
    expect(side.option).toMatchObject({
      series: [{ center: ["73%", "50%"], label: { show: false } }],
      title: { left: "8%", show: true, textAlign: "left" },
    });
    expect(stacked.option).toMatchObject({
      series: [{ center: ["50%", "69%"], label: { show: false } }],
      title: { left: "50%", show: true, textAlign: "center" },
    });
    expect(sideBreakdown.option).toMatchObject({
      legend: { show: false },
      series: [{ center: ["75%", "50%"], label: { show: false } }],
      title: { left: "75%", show: true, textAlign: "center" },
    });
    expect(stackedBreakdown.option).toMatchObject({
      legend: { show: false },
      series: [{ center: ["50%", "27%"], label: { show: false } }],
      title: { left: "50%", show: true, textAlign: "center" },
    });
  });

  it("includes the category value list in fixed large output", () => {
    const side = buildEChartsOption({
      ...buildFixture("doughnut"),
      renderContext: { height: 300, surface: "dashboard", width: 800 },
    });
    const stacked = buildEChartsOption({
      ...buildFixture("pie"),
      renderContext: { height: 400, surface: "dashboard", width: 424 },
    });

    expect(side.graphic[0]).toMatchObject({ left: 40, type: "group" });
    expect(side.graphic[0].children.some((item) => item.style?.text === "Pro")).toBe(true);
    expect(side.graphic[0].children.some((item) => item.style?.text === "70%")).toBe(true);
    expect(stacked.graphic[0]).toMatchObject({ left: 34, top: 200, type: "group" });
    expect(stacked.graphic[0].children.some((item) => item.style?.text === "30")).toBe(true);
  });

  it("keeps the pie total hidden only in the centered layout", () => {
    const option = buildEChartsOption(buildFixture("pie"));

    expect(option.title.show).toBe(false);
    expect(option.title.text).toContain("{label|Total}");
    expect(option.dataset[0].source[0]).toMatchObject({
      formattedPercent: "70%",
      formattedValue: "70",
    });
    expect(option.media.find((media) => media.query.minWidth === 260).option.title.show).toBe(true);
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

  it("draws only the final line segment with a dashed style", () => {
    const fixture = buildFixture("line");
    fixture.visualization.settings.dashedLastPoint = true;
    fixture.preparedData.results[0].rows = [
      { category: "Jan", seriesId: defaultSeries[0].id, value: 10 },
      { category: "Feb", seriesId: defaultSeries[0].id, value: 20 },
      { category: "Mar", seriesId: defaultSeries[0].id, value: 30 },
      { category: "Apr", seriesId: defaultSeries[0].id, value: 40 },
    ];

    const option = buildEChartsOption(fixture);
    const [base, dashed, latestPoint] = option.series;

    expect(option.xAxis.data).toEqual(["Jan", "Feb", "Mar", "Apr"]);
    expect(base.data).toEqual([10, 20, 30, null]);
    expect(dashed).toMatchObject({
      data: [null, null, 30, 40],
      id: `${defaultSeries[0].id}--dashed-last`,
      lineStyle: { type: [5, 10] },
      name: "Revenue",
      silent: true,
      tooltip: { show: false },
      type: "line",
    });
    expect(latestPoint).toMatchObject({
      data: [null, null, null, 40],
      id: `${defaultSeries[0].id}--latest-point`,
      name: "Revenue",
      type: "scatter",
    });
  });

  it("shows horizontal bar categories in the prepared sort order from top to bottom", () => {
    const fixture = buildFixture("horizontalBar");
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

  it("contains line responsive rules and reduced-motion support", () => {
    const fixture = buildFixture("line");
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
      expect.objectContaining({ query: { maxHeight: 149, minWidth: 260 } }),
      expect.objectContaining({ query: { maxWidth: 259 } }),
    ]));
    expect(option.aria.enabled).toBe(true);
    expect(option.aria.decal.show).toBe(false);
  });

  it("compiles line analysis, limited, and sparkline compositions", () => {
    const fixture = buildFixture("line");
    fixture.preparedData.results[0].rows = Array.from({ length: 30 }, (_, index) => ({
      category: `Day ${index + 1}`,
      seriesId: defaultSeries[0].id,
      value: index + 1,
    }));
    const option = buildEChartsOption(fixture);
    const limited = option.media.find((item) => item.query.maxWidth === 519);
    const narrow = option.media.find((item) => item.query.maxWidth === 259);
    const shallow = option.media.find((item) => item.query.maxHeight === 149);

    expect(limited.query).toEqual({ maxWidth: 519, minHeight: 150, minWidth: 260 });
    expect(limited.option).toMatchObject({
      legend: { show: true },
      series: [{ label: { show: false }, showSymbol: false, symbolSize: 0 }],
      xAxis: { axisLabel: { interval: 5, showMaxLabel: true, showMinLabel: true } },
      yAxis: { splitLine: { lineStyle: { opacity: 0.28 }, show: true } },
    });
    expect(narrow.option).toMatchObject({
      grid: { containLabel: false },
      legend: { show: false },
      series: [{ label: { show: false }, showSymbol: false, symbolSize: 0 }],
      xAxis: { show: false },
      yAxis: { show: false },
    });
    expect(shallow.query).toEqual({ maxHeight: 149, minWidth: 260 });
    expect(shallow.option.xAxis.show).toBe(false);
    expect(shallow.option.yAxis.show).toBe(false);
  });

  it("keeps the saved fill treatment in every responsive line composition", () => {
    const fixture = buildFixture("line");
    fixture.visualization.layers[0].style.fill = true;
    fixture.preparedData.results[0].rows = Array.from({ length: 30 }, (_, index) => ({
      category: `Day ${index + 1}`,
      seriesId: defaultSeries[0].id,
      value: index + 1,
    }));
    const option = buildEChartsOption(fixture);
    const limited = option.media.find((item) => item.query.maxWidth === 519);
    const narrow = option.media.find((item) => item.query.maxWidth === 259);
    const shallow = option.media.find((item) => item.query.maxHeight === 149);

    expect(option.series[0].areaStyle).toMatchObject({ opacity: 0.2 });
    expect(limited.query).toEqual({ maxWidth: 519, minHeight: 150, minWidth: 260 });
    expect(limited.option).toMatchObject({
      legend: { show: true },
      series: [{ label: { show: false }, showSymbol: false, symbolSize: 0 }],
      xAxis: { axisLabel: { interval: 5, showMaxLabel: true, showMinLabel: true } },
      yAxis: { splitLine: { lineStyle: { opacity: 0.28 }, show: true } },
    });
    expect(narrow.option).toMatchObject({
      grid: { containLabel: false },
      legend: { show: false },
      series: [{ label: { show: false }, showSymbol: false, symbolSize: 0 }],
      xAxis: { show: false },
      yAxis: { show: false },
    });
    expect(shallow.query).toEqual({ maxHeight: 149, minWidth: 260 });
    expect(shallow.option.xAxis.show).toBe(false);
    expect(shallow.option.yAxis.show).toBe(false);
  });

  it("compiles vertical bar analysis, limited, and sparkline compositions", () => {
    const fixture = buildFixture("bar");
    fixture.preparedData.results[0].rows = Array.from({ length: 30 }, (_, index) => ({
      category: `Day ${index + 1}`,
      seriesId: defaultSeries[0].id,
      value: index + 1,
    }));
    const option = buildEChartsOption(fixture);
    const limited = option.media.find((item) => item.query.maxWidth === 519);
    const narrow = option.media.find((item) => item.query.maxWidth === 259);
    const shallow = option.media.find((item) => item.query.maxHeight === 149);

    expect(limited.query).toEqual({ maxWidth: 519, minHeight: 150, minWidth: 260 });
    expect(limited.option).toMatchObject({
      legend: { show: true },
      series: [{ label: { show: false } }],
      xAxis: { axisLabel: { interval: 5, showMaxLabel: true, showMinLabel: true } },
      yAxis: { splitLine: { lineStyle: { opacity: 0.28 }, show: true } },
    });
    expect(narrow.option).toMatchObject({
      grid: { containLabel: false },
      legend: { show: false },
      series: [{ label: { show: false } }],
      xAxis: { show: false },
      yAxis: { show: false },
    });
    expect(shallow.query).toEqual({ maxHeight: 149, minWidth: 260 });
    expect(shallow.option.xAxis.show).toBe(false);
    expect(shallow.option.yAxis.show).toBe(false);
    expect(option.series[0].label.show).toBe(true);
  });

  it("limits wide vertical bar charts when their mark density is high", () => {
    const fixture = buildFixture("bar");
    fixture.preparedData.results[0].rows = Array.from({ length: 80 }, (_, index) => ({
      category: `Day ${index + 1}`,
      seriesId: defaultSeries[0].id,
      value: index + 1,
    }));
    const option = buildEChartsOption(fixture);
    const dense = option.media.find((item) => item.query.minWidth === 520);

    expect(dense.query).toEqual({ maxWidth: 1120, minHeight: 150, minWidth: 520 });
    expect(dense.option.series[0].label.show).toBe(false);
    expect(dense.option.xAxis.axisLabel.interval).toBe(15);
  });

  it("compiles horizontal comparison axes and compact media", () => {
    const fixture = buildFixture("horizontalBar");
    const option = buildEChartsOption(fixture);

    expect(option.series[0]).toMatchObject({
      barMaxWidth: 28,
      encode: { x: defaultSeries[0].id, y: "category" },
      itemStyle: { borderRadius: 3 },
      type: "bar",
    });
    expect(option.series[0].blur.itemStyle).toMatchObject({
      opacity: 0.24,
    });
    expect(option.tooltip.axisPointer.type).toBe("shadow");
    expect(option.legend.left).toBe(0);
    expect(option.grid).toMatchObject({ bottom: 4, containLabel: true, top: 28 });
    expect(option.xAxis).toMatchObject({
      axisLabel: { color: "#a1a1aa" },
      axisLine: { lineStyle: { color: "#a1a1aa", width: 1 } },
      position: "top",
      splitLine: { show: false },
      type: "value",
    });
    expect(option.yAxis).toMatchObject({
      axisLabel: { align: "left", color: "#a1a1aa" },
      inverse: true,
      type: "category",
    });
    expect(option.media).toEqual(expect.arrayContaining([
      expect.objectContaining({ query: { maxHeight: 149, minWidth: 260 } }),
      expect.objectContaining({ query: { maxWidth: 259 } }),
    ]));
  });

  it("keeps every stacked horizontal series in the active comparison row", () => {
    const fixture = buildFixture("horizontalBar");
    const secondSeries = {
      id: "series-4444444444444444",
      key: "string:__default__",
      label: "Trials",
      value: null,
    };
    fixture.visualization.layers[0].stack = "normal";
    fixture.visualization.layers.push({
      ...fixture.visualization.layers[0],
      bindingId: "binding-2",
      id: "layer-2",
      name: "Trials",
    });
    fixture.preparedData.results.push({
      ...fixture.preparedData.results[0],
      availableSeries: [secondSeries],
      bindingId: "binding-2",
      id: "layer-2",
      name: "Trials",
      rows: [
        { category: "Jan", seriesId: secondSeries.id, value: 5 },
        { category: "Feb", seriesId: secondSeries.id, value: 8 },
        { category: "Mar", seriesId: secondSeries.id, value: 12 },
      ],
      series: [secondSeries],
    });

    const option = buildEChartsOption(fixture);

    expect(option.tooltip).toMatchObject({
      axisPointer: { type: "shadow" },
      trigger: "axis",
    });
    expect(option.series).toHaveLength(2);
    expect(option.series.every((series) => series.stack === "stack-normal")).toBe(true);
    expect(option.series.every((series) => series.label.position === "inside")).toBe(true);
    expect(option.series.every((series) => series.emphasis.focus === "self")).toBe(true);
    expect(option.series.every((series) => series.emphasis.itemStyle.opacity === 1)).toBe(true);
    expect(option.series.every((series) => series.blur.itemStyle.opacity === 0.24)).toBe(true);
    expect(option.series[0].itemStyle.borderRadius).toEqual([3, 0, 0, 3]);
    expect(option.series[1].itemStyle.borderRadius).toEqual([0, 3, 3, 0]);
    expect(option.series.every((series) => series.itemStyle.borderWidth === 0)).toBe(true);
  });

  it("limits wide line charts when their mark density is high", () => {
    const fixture = buildFixture("line");
    fixture.preparedData.results[0].rows = Array.from({ length: 80 }, (_, index) => ({
      category: `Day ${index + 1}`,
      seriesId: defaultSeries[0].id,
      value: index + 1,
    }));
    const option = buildEChartsOption(fixture);
    const dense = option.media.find((item) => item.query.minWidth === 520);

    expect(dense.query).toEqual({ maxWidth: 1120, minHeight: 150, minWidth: 520 });
    expect(dense.option.series[0].label.show).toBe(false);
    expect(dense.option.xAxis.axisLabel.interval).toBe(15);
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

  it("sizes bounded matrix cells as squares and keeps readable axes", () => {
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
    expect(option.grid.left).toBeGreaterThan(6);
    expect(option.grid.top).toBeGreaterThanOrEqual(10);
    const rightSpace = 800 - option.grid.left - option.grid.width;
    const bottomSpace = 200 - option.grid.top - option.grid.height;
    expect(Math.abs((option.grid.left - 6) - (rightSpace - 36))).toBeLessThanOrEqual(1);
    expect(Math.abs((option.grid.top - 10) - (bottomSpace - 22))).toBeLessThanOrEqual(1);
    const cellGap = Math.min(3, Math.max(1, Math.floor(cellSize * 0.12)));
    expect(option.series[0]).toMatchObject({
      symbol: "roundRect",
      symbolKeepAspect: true,
      symbolSize: cellSize - cellGap,
      type: "scatter",
    });
    expect(option.xAxis.show).toBe(true);
    expect(option.yAxis.show).toBe(true);
    expect(option.media).toBeUndefined();
  });

  it("hides matrix axes and reduces cell gaps in dense layouts", () => {
    const option = buildEChartsOption({
      ...buildFixture("matrix"),
      renderContext: { height: 104, surface: "dashboard", width: 424 },
    });
    const cellSize = option.grid.height / option.yAxis.data.length;

    expect(option.grid).toMatchObject({ containLabel: false });
    expect(option.grid.left).toBeGreaterThanOrEqual(6);
    expect(option.grid.top).toBeGreaterThanOrEqual(6);
    expect(option.xAxis.show).toBe(false);
    expect(option.yAxis.show).toBe(false);
    expect(option.series[0].symbolSize).toBeGreaterThanOrEqual(cellSize - 2);
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
      show: false,
    });
    expect(pointer.pointer).toMatchObject({
      length: "50%",
      offsetCenter: [0, "-50%"],
    });
    expect(pointer.radius).toBe("90%");
    expect(pointer.title.offsetCenter).toEqual([0, "22%"]);
    expect(pointer.title.show).toBe(false);
    expect(pointer.tooltip.show).toBe(false);
    expect(option.title).toMatchObject({
      left: "50%",
      text: "{value|72} {marker|●}\n{label|Revenue}",
      textAlign: "center",
      top: "55%",
    });
    expect(option.title.textStyle.rich).toMatchObject({
      label: { color: "#71717a", fontWeight: 400 },
      marker: { color: "#22c55e", padding: [0, 0, 0, 8] },
      value: {
        fontFamily: "Inter Tight, sans-serif",
        fontSize: 42,
        fontWeight: 700,
      },
    });
  });

  it("balances the gauge summary and mark in shallow wide containers", () => {
    const option = buildEChartsOption(buildFixture("gauge"));
    const sideLayout = option.media.find((media) => media.query.minWidth === 260);
    const microLayout = option.media.find((media) => (
      media.query.maxWidth === 259 && media.query.maxHeight === 149
    ));
    const narrowLayout = option.media.find((media) => (
      media.query.maxWidth === 259 && media.query.minHeight === 150
    ));

    expect(sideLayout.query).toEqual({ maxHeight: 160, minWidth: 260 });
    expect(sideLayout.option.title).toMatchObject({
      left: "8%",
      textAlign: "left",
      top: "50%",
      textStyle: {
        rich: {
          label: { fontSize: 13 },
          marker: { fontSize: 10 },
          value: { fontSize: 28 },
        },
      },
    });
    expect(sideLayout.option.series[0]).toMatchObject({
      center: ["72%", "50%"],
      radius: ["72%", "92%"],
    });
    expect(sideLayout.option.series[1].detail.show).toBe(false);
    expect(sideLayout.option.series[1].title.show).toBe(false);
    expect(microLayout.query).toEqual({ maxHeight: 149, maxWidth: 259 });
    expect(microLayout.option.title.show).toBe(false);
    expect(microLayout.option.series[0]).toMatchObject({
      center: ["50%", "55%"],
      radius: ["70%", "90%"],
    });
    expect(narrowLayout.query).toEqual({ maxWidth: 259, minHeight: 150 });
    expect(narrowLayout.option.series[0]).toMatchObject({
      center: ["50%", "70%"],
      radius: ["52%", "70%"],
    });
    expect(narrowLayout.option.title).toMatchObject({
      left: "50%",
      textVerticalAlign: "top",
      top: "8%",
    });
    expect(narrowLayout.option.series[1].title.show).toBe(false);
    expect(narrowLayout.option.series[1].detail.show).toBe(false);
  });

  it("uses the next gauge range color at a shared boundary", () => {
    const fixture = buildFixture("gauge");
    fixture.preparedData.results[0].rows[0].value = 80;
    const option = buildEChartsOption(fixture);

    expect(option.title.textStyle.rich.marker.color).toBe("#ef4444");
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

  it("limits KPI chart overlays to cartesian trend presets", () => {
    const supported = PRESET_MANIFEST.presets
      .filter((preset) => preset.capabilities.includes("kpiOverlay"))
      .map((preset) => preset.id);

    expect(supported).toEqual(["line", "bar"]);
  });
});
