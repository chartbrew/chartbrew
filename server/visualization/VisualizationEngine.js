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

  render(options = {}) {
    const resolved = this.buildFrame(options);
    const marks = [...new Set(resolved.frame.layers.map((layer) => layer.mark))];

    let compiled;
    if (marks.length === 1 && (marks[0] === "bar" || marks[0] === "line")) {
      compiled = compileChartJsCartesian({
        chart: this.chart,
        frame: resolved.frame,
        runtimeContext: resolved.runtimeContext,
        timezone: this.timezone,
        visualization: resolved.visualization,
      });
    } else if (marks.length === 1 && CATEGORY_MARKS.has(marks[0])) {
      compiled = compileChartJsCategory({
        chart: this.chart,
        frame: resolved.frame,
        visualization: resolved.visualization,
      });
    } else if (marks.length === 1 && METRIC_MARKS.has(marks[0])) {
      compiled = compileChartJsMetric({
        chart: this.chart,
        frame: resolved.frame,
        visualization: resolved.visualization,
      });
    } else if (marks.length === 1 && marks[0] === "table") {
      compiled = compileChartJsTable({
        chart: this.chart,
        conditionsOptions: resolved.conditionsOptions,
        datasets: resolved.datasets,
        frame: resolved.frame,
        timezone: this.timezone,
        visualization: resolved.visualization,
      });
    } else if (marks.length === 1 && marks[0] === "matrix") {
      compiled = compileChartJsMatrix({
        chart: this.chart,
        frame: resolved.frame,
        runtimeContext: resolved.runtimeContext,
        timezone: this.timezone,
        visualization: resolved.visualization,
      });
    } else if (marks.length === 1 && marks[0] === "markdown") {
      compiled = {
        configuration: { content: resolved.visualization.layers[0]?.content || this.chart.content || "" },
        frame: resolved.frame,
        isTimeseries: false,
      };
    } else {
      throw new Error(`Visualization compiler is not implemented for: ${marks.join(", ")}`);
    }

    return {
      ...compiled,
      adapted: resolved.adapted,
      conditionsOptions: resolved.conditionsOptions,
      visualization: resolved.visualization,
    };
  }

  export(options = {}) {
    if (options.mode === "shown") {
      const rendered = this.render(options);
      return {
        adapted: rendered.adapted,
        conditionsOptions: rendered.conditionsOptions,
        configuration: compileShownExport(rendered.configuration, this.chart),
        exportMode: "shown",
        visualization: rendered.visualization,
      };
    }
    const resolved = this.buildFrame(options);
    return {
      ...compileTabularExport({
        conditionsOptions: resolved.conditionsOptions,
        datasets: resolved.datasets,
        visualization: resolved.visualization,
      }),
      adapted: resolved.adapted,
      exportMode: "source",
      visualization: resolved.visualization,
    };
  }
}

module.exports = {
  VisualizationEngine,
  parseStoredVisualization,
  resolveVisualization,
};
