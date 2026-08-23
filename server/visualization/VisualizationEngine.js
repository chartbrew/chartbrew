const { compileChartJsCartesian } = require("./compilers/chartJsCartesian");
const { CATEGORY_MARKS, compileChartJsCategory } = require("./compilers/chartJsCategory");
const { compileChartJsMatrix } = require("./compilers/chartJsMatrix");
const { METRIC_MARKS, compileChartJsMetric } = require("./compilers/chartJsMetric");
const { compileChartJsTable } = require("./compilers/chartJsTable");
const { compileTabularExport } = require("./compilers/tabularExport");
const { compileShownExport } = require("./compilers/shownExport");
const { recordAdapterUsage } = require("./adapterUsage");
const { filterVisualizationDatasets } = require("./filterDatasets");
const { buildVisualizationFrame } = require("./frameBuilder");
const { legacyChartToVisualization } = require("./legacyChartToVisualization");
const { assertPreparedData, createPreparedData } = require("./preparedData");
const { getServerPresetImplementation } = require("./presetImplementations");
const { assertVisualizationSpec } = require("./spec");

function parseStoredVisualization(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function resolveVisualization(chart) {
  const stored = parseStoredVisualization(chart?.visualization);
  if (stored) {
    return {
      adapted: false,
      visualization: assertVisualizationSpec(stored, {
        allowIncomplete: stored.status !== "ready",
      }),
    };
  }

  const converted = legacyChartToVisualization(chart);
  if (!converted.valid) {
    throw new Error(converted.errors.join("; "));
  }

  recordAdapterUsage(chart);

  return {
    adapted: true,
    visualization: converted.visualization,
  };
}

class VisualizationEngine {
  constructor({ chart, datasets, timezone }) {
    this.chart = chart;
    this.datasets = datasets;
    this.timezone = timezone;
  }

  buildFrame(options = {}) {
    const resolved = resolveVisualization(this.chart);
    const filtered = filterVisualizationDatasets({
      chart: this.chart,
      datasets: this.datasets,
      filters: options.filters,
      timezone: options.timezone || this.timezone,
      variables: options.variables,
      visualization: resolved.visualization,
    });
    const frame = buildVisualizationFrame({
      datasets: filtered.datasets,
      visualization: resolved.visualization,
    }, {
      ...options,
      timeInterval: options.timeInterval || this.chart?.timeInterval,
      timezone: options.timezone || this.timezone,
    });

    return {
      ...resolved,
      conditionsOptions: filtered.conditionsOptions,
      datasets: filtered.datasets,
      frame,
      runtimeContext: filtered.runtimeContext,
    };
  }

  prepare(options = {}) {
    const resolved = this.buildFrame(options);
    const preparedData = createPreparedData({
      chart: this.chart,
      datasets: resolved.datasets,
      frame: resolved.frame,
      generatedAt: options.generatedAt,
      timezone: options.timezone || this.timezone,
      visualization: resolved.visualization,
    });

    return {
      ...resolved,
      preparedData,
    };
  }

  compilePrepared(preparedData, resolved, options = {}) {
    const marks = [...new Set(preparedData.results.map((result) => result.mark))];

    let compiled;
    if (marks.length === 1 && ["area", "bar", "horizontalBar", "line"].includes(marks[0])) {
      compiled = compileChartJsCartesian({
        chart: this.chart,
        preparedData,
        runtimeContext: resolved.runtimeContext,
        timezone: options.timezone || this.timezone,
        visualization: resolved.visualization,
      });
    } else if (marks.length === 1 && CATEGORY_MARKS.has(marks[0])) {
      compiled = compileChartJsCategory({
        chart: this.chart,
        preparedData,
        visualization: resolved.visualization,
      });
    } else if (marks.length === 1 && METRIC_MARKS.has(marks[0])) {
      compiled = compileChartJsMetric({
        chart: this.chart,
        preparedData,
        visualization: resolved.visualization,
      });
    } else if (marks.length === 1 && marks[0] === "table") {
      compiled = compileChartJsTable({
        chart: this.chart,
        conditionsOptions: resolved.conditionsOptions,
        preparedData,
        timezone: options.timezone || this.timezone,
        visualization: resolved.visualization,
      });
    } else if (marks.length === 1 && marks[0] === "matrix") {
      compiled = compileChartJsMatrix({
        chart: this.chart,
        preparedData,
        runtimeContext: resolved.runtimeContext,
        timezone: options.timezone || this.timezone,
        visualization: resolved.visualization,
      });
    } else if (marks.length === 1 && marks[0] === "markdown") {
      compiled = {
        configuration: {
          content: preparedData.results[0]?.rows[0]?.content
            ?? resolved.visualization.layers[0]?.content
            ?? this.chart.content
            ?? "",
        },
        preparedData,
        isTimeseries: false,
      };
    } else {
      throw new Error(`Visualization compiler is not implemented for: ${marks.join(", ")}`);
    }

    const presetId = marks[0];
    const presetImplementation = getServerPresetImplementation(presetId);
    let renderer = "chartjs";
    let renderConfiguration = compiled.configuration;
    if (presetImplementation?.renderer === "native") {
      presetImplementation.validate({
        preparedData,
        visualization: resolved.visualization,
      });
      renderer = "native";
    } else if (presetImplementation?.renderer === "echarts") {
      try {
        renderConfiguration = presetImplementation.compile({
          chart: this.chart,
          preparedData,
          renderContext: options.renderContext,
          visualization: resolved.visualization,
        });
        renderer = "echarts";
      } catch (error) {
        console.error(`[visualization] ECharts fallback for ${presetId}: ${error.message}`); // oxlint-disable-line no-console
      }
    }

    return {
      ...compiled,
      adapted: resolved.adapted,
      conditionsOptions: resolved.conditionsOptions,
      frame: resolved.frame,
      preparedData,
      renderConfiguration,
      renderer,
      visualization: resolved.visualization,
    };
  }

  render(options = {}) {
    const resolved = this.prepare(options);
    return this.compilePrepared(resolved.preparedData, resolved, options);
  }

  renderPrepared(preparedData, options = {}) {
    const resolved = resolveVisualization(this.chart);
    const validatedPreparedData = assertPreparedData(preparedData);
    return this.compilePrepared(validatedPreparedData, {
      ...resolved,
      conditionsOptions: options.conditionsOptions || [],
      frame: null,
      runtimeContext: options.runtimeContext || null,
    }, {
      ...options,
      timezone: options.timezone || validatedPreparedData.timezone || this.timezone,
    });
  }

  export(options = {}) {
    if (options.mode === "shown") {
      const resolved = this.prepare(options);
      const marks = [...new Set(resolved.preparedData.results.map((result) => result.mark))];
      let configuration;
      if (marks.length === 1 && marks[0] === "table") {
        configuration = compileChartJsTable({
          chart: this.chart,
          conditionsOptions: resolved.conditionsOptions,
          preparedData: resolved.preparedData,
          timezone: options.timezone || this.timezone,
          visualization: resolved.visualization,
        }).configuration;
      } else if (marks.length === 1 && marks[0] === "markdown") {
        configuration = {
          content: resolved.preparedData.results[0]?.rows[0]?.content
            ?? resolved.visualization.layers[0]?.content
            ?? this.chart.content
            ?? "",
        };
      } else if (marks.length === 1 && marks[0] === "matrix") {
        configuration = compileChartJsMatrix({
          chart: this.chart,
          preparedData: resolved.preparedData,
          runtimeContext: resolved.runtimeContext,
          timezone: options.timezone || this.timezone,
          visualization: resolved.visualization,
        }).configuration;
      } else {
        configuration = compileShownExport({
          chart: this.chart,
          preparedData: resolved.preparedData,
          runtimeContext: resolved.runtimeContext,
          timezone: options.timezone || this.timezone,
          visualization: resolved.visualization,
        });
      }
      return {
        adapted: resolved.adapted,
        conditionsOptions: resolved.conditionsOptions,
        configuration,
        exportMode: "shown",
        preparedData: resolved.preparedData,
        visualization: resolved.visualization,
      };
    }
    const resolved = this.prepare(options);
    return {
      ...compileTabularExport({
        conditionsOptions: resolved.conditionsOptions,
        datasets: resolved.datasets,
        visualization: resolved.visualization,
      }),
      adapted: resolved.adapted,
      exportMode: "source",
      preparedData: resolved.preparedData,
      visualization: resolved.visualization,
    };
  }
}

module.exports = {
  VisualizationEngine,
  parseStoredVisualization,
  resolveVisualization,
};
