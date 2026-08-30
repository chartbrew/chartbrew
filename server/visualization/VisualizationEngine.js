const { compileNativeMetric } = require("./compilers/nativeMetric");
const { compileNativeTable } = require("./compilers/nativeTable");
const { compileTabularExport } = require("./compilers/tabularExport");
const { compileShownExport } = require("./compilers/shownExport");
const { recordAdapterUsage } = require("./adapterUsage");
const { filterVisualizationDatasets } = require("./filterDatasets");
const { buildVisualizationFrame } = require("./frameBuilder");
const { legacyChartToVisualization } = require("./legacyChartToVisualization");
const { assertPreparedData, createPreparedData } = require("./preparedData");
const { getServerPresetImplementation } = require("./presetImplementations");
const { buildRenderMetadata } = require("./renderMetadata");
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
    if (marks.length !== 1) {
      throw new Error(`Visualization requires one ready preset, received: ${marks.join(", ")}`);
    }

    const presetId = marks[0];
    const implementation = getServerPresetImplementation(presetId);
    if (!implementation) {
      throw new Error(`Visualization compiler is not implemented for: ${presetId}`);
    }
    implementation.validate({ preparedData, visualization: resolved.visualization });

    let configuration;
    if (["avg", "kpi"].includes(presetId)) {
      configuration = compileNativeMetric({
        chart: this.chart,
        preparedData,
        runtimeContext: resolved.runtimeContext,
        timezone: options.timezone || this.timezone,
        visualization: resolved.visualization,
      }).configuration;
    } else if (presetId === "table") {
      configuration = compileNativeTable({
        chart: this.chart,
        conditionsOptions: resolved.conditionsOptions,
        preparedData,
        timezone: options.timezone || this.timezone,
        visualization: resolved.visualization,
      }).configuration;
    } else if (presetId === "markdown") {
      configuration = {
        content: preparedData.results[0]?.rows[0]?.content
          ?? resolved.visualization.layers[0]?.content
          ?? this.chart.content
          ?? "",
      };
    } else {
      configuration = implementation.compile({
        chart: this.chart,
        preparedData,
        renderContext: options.renderContext,
        visualization: resolved.visualization,
      });
    }

    const metadata = buildRenderMetadata({
      chart: this.chart,
      preparedData,
      runtimeContext: resolved.runtimeContext,
      timezone: options.timezone || this.timezone,
      visualization: resolved.visualization,
    });
    let tabularData;
    if (presetId === "table") {
      tabularData = configuration;
    } else if (presetId === "markdown") {
      tabularData = {
        [this.chart.name || "Chart"]: [{ Content: configuration.content }],
      };
    } else {
      tabularData = compileShownExport({
        chart: this.chart,
        preparedData,
        runtimeContext: resolved.runtimeContext,
        timezone: options.timezone || this.timezone,
        visualization: resolved.visualization,
      });
    }

    return {
      adapted: resolved.adapted,
      conditionsOptions: resolved.conditionsOptions,
      configuration,
      dateFormat: metadata.dateFormat,
      frame: resolved.frame,
      isTimeseries: metadata.isTimeseries,
      metadata,
      preparedData,
      renderer: implementation.renderer,
      tabularData,
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
        configuration = compileNativeTable({
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
