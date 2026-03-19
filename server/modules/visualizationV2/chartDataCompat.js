const FormulaParser = require("hot-formula-parser").Parser;
const momentObj = require("moment-timezone");

const BarChart = require("../../charts/BarChart");
const LineChart = require("../../charts/LineChart");
const MatrixChart = require("../../charts/MatrixChart");
const PieChart = require("../../charts/PieChart");
const { VizFrameCompatibilityError } = require("./vizFrame");

const parser = new FormulaParser();

function formatCompactNumber(number) {
  if (number < 1000) {
    return number;
  }

  if (number < 1_000_000) {
    return `${(number / 1000).toFixed(1)}K`;
  }

  if (number < 1_000_000_000) {
    return `${(number / 1_000_000).toFixed(1)}M`;
  }

  if (number < 1_000_000_000_000) {
    return `${(number / 1_000_000_000).toFixed(1)}B`;
  }

  if (number < 1_000_000_000_000_000) {
    return `${(number / 1_000_000_000_000).toFixed(1)}T`;
  }

  return 0;
}

function selectChartBuilder(chart, datasets, axisData) {
  switch (chart.type) {
    case "line":
    case "kpi":
    case "avg":
      return new LineChart(chart, datasets, axisData);
    case "bar":
      return new BarChart(chart, datasets, axisData);
    default:
      return new PieChart(chart, datasets, axisData);
  }
}

function applyFormulaToSeries(chart, frameSeries = []) {
  return frameSeries.map((series) => {
    const cdc = chart.ChartDatasetConfigs.find((item) => `${item.id}` === `${series.cdcId}`) || {};
    if (!cdc?.formula) {
      return {
        ...series,
      };
    }

    const data = series.data.map((value) => {
      const before = cdc.formula.substring(0, cdc.formula.indexOf("{"));
      const after = cdc.formula.substring(cdc.formula.indexOf("}") + 1);
      const expressionString = cdc.formula.substring(
        cdc.formula.indexOf("{") + 1,
        cdc.formula.indexOf("}"),
      );
      const expression = expressionString.replace(/val/g, value);
      const nextValue = parser.parse(expression);

      if (chart.type === "kpi" || chart.type === "avg" || chart.type === "gauge") {
        return `${before}${nextValue.result?.toLocaleString() || 0}${after}`;
      }

      return +(nextValue.result?.toFixed(2) || 0).toLocaleString();
    });

    return {
      ...series,
      data,
    };
  });
}

function buildAxisData(frame, chart) {
  const labels = frame.labels.map((label) => label.label);
  let series = applyFormulaToSeries(chart, frame.series);

  if (chart.type === "avg") {
    series = series.map((item) => {
      let total = 0;
      item.data.forEach((value) => {
        total += Number(value) || 0;
      });

      const average = item.data.length > 0 ? total / item.data.length : 0;
      const formattedAverage = `${average}`.includes(".")
        ? Number(average.toFixed(2))
        : average;

      return {
        ...item,
        data: [formattedAverage],
      };
    });
  }

  return {
    x: labels,
    y: series.map((item) => item.data),
    labels,
    series,
  };
}

function applySortAndLimit(chart, configuration) {
  const nextDatasets = configuration.data.datasets.map((dataset) => ({
    ...dataset,
    data: Array.isArray(dataset.data) ? [...dataset.data] : dataset.data,
  }));
  let nextLabels = configuration.data.labels;

  let sortIndex = null;
  chart.ChartDatasetConfigs.forEach((cdc, index) => {
    if (cdc.sort) {
      sortIndex = index;
    }
  });

  if (sortIndex !== null) {
    for (let i = 0; i < nextDatasets[sortIndex].data.length - 1; i += 1) {
      for (let j = i + 1; j < nextDatasets[sortIndex].data.length; j += 1) {
        let shouldSwap = false;

        if (chart.ChartDatasetConfigs[sortIndex].sort === "asc") {
          shouldSwap = nextDatasets[sortIndex].data[i] > nextDatasets[sortIndex].data[j];
        } else if (chart.ChartDatasetConfigs[sortIndex].sort === "desc") {
          shouldSwap = nextDatasets[sortIndex].data[i] < nextDatasets[sortIndex].data[j];
        }

        if (shouldSwap) {
          const savedValue = nextDatasets[sortIndex].data[i];
          nextDatasets[sortIndex].data[i] = nextDatasets[sortIndex].data[j];
          nextDatasets[sortIndex].data[j] = savedValue;

          const savedLabel = nextLabels[i];
          nextLabels[i] = nextLabels[j];
          nextLabels[j] = savedLabel;

          for (let datasetIndex = 0; datasetIndex < nextDatasets.length; datasetIndex += 1) {
            if (datasetIndex !== sortIndex) {
              const savedDatasetValue = nextDatasets[datasetIndex].data[i];
              nextDatasets[datasetIndex].data[i] = nextDatasets[datasetIndex].data[j];
              nextDatasets[datasetIndex].data[j] = savedDatasetValue;
            }
          }
        }
      }
    }
  }

  chart.ChartDatasetConfigs.forEach((cdc, index) => {
    if (cdc.maxRecords) {
      nextDatasets[index].data = nextDatasets[index].data.slice(0, cdc.maxRecords);
      nextLabels = nextLabels.slice(0, cdc.maxRecords);
    }
  });

  return {
    ...configuration,
    data: {
      ...configuration.data,
      datasets: nextDatasets,
      labels: nextLabels,
    },
  };
}

function buildGrowthAndGoals(chart, configuration) {
  const growth = [];
  const goals = [];

  configuration.data.datasets.forEach((dataset, index) => {
    const { formula, goal } = chart.ChartDatasetConfigs[index] || {};
    const before = formula ? formula.substring(0, formula.indexOf("{")) : "";
    const after = formula ? formula.substring(formula.indexOf("}") + 1) : "";

    if (dataset.data && dataset.data.length > 1 && dataset.data[dataset.data.length - 2] !== 0) {
      let currentValue;
      let previousValue;

      try {
        const numericCurrent = `${dataset.data[dataset.data.length - 1]}`
          .replace(",", "")
          .match(/-?[\d.]+/g);
        const numericPrevious = `${dataset.data[dataset.data.length - 2]}`
          .replace(",", "")
          .match(/-?[\d.]+/g);

        currentValue = parseFloat(numericCurrent.filter((item) => item !== "." && item !== ",")[0]);
        previousValue = parseFloat(numericPrevious.filter((item) => item !== "." && item !== ",")[0]);
      } catch (error) {
        currentValue = undefined;
        previousValue = undefined;
      }

      if (typeof currentValue === "number" && typeof previousValue === "number") {
        let comparison = ((currentValue - previousValue) / previousValue) * 100;

        if (chart.invertGrowth) {
          comparison = -comparison;
        }

        growth.push({
          value: `${before}${currentValue.toLocaleString()}${after}`,
          comparison: (comparison === 0 && 0) || +(comparison.toFixed(2)).toLocaleString(),
          status: (comparison > 0 && "positive") || (comparison < 0 && "negative") || "neutral",
          label: dataset.label,
        });

        if (goal) {
          const valueIndex = chart?.subType?.indexOf("AddTimeseries") > -1
            ? dataset.data.length - 1
            : index;
          const goalCurrentValue = `${dataset.data[valueIndex]}`.replace(",", "").match(/[\d.]+/g);

          goals.push({
            max: goal,
            formattedMax: `${before}${formatCompactNumber(goal)}${after}`,
            value: goalCurrentValue,
            formattedValue: `${before}${currentValue.toLocaleString()}${after}`,
            goalIndex: index,
          });
        }
      }

      return;
    }

    if (dataset.data && dataset.data.length === 1) {
      growth.push({
        value: `${before}${dataset.data[0]}${after}`,
        comparison: chart.invertGrowth ? -100 : 100,
        status: chart.invertGrowth ? "negative" : "positive",
        label: dataset.label,
      });

      if (goal) {
        const numericValue = `${dataset.data[dataset.data.length - 1]}`
          .replace(",", "")
          .match(/[\d.]+/g);

        goals.push({
          max: goal,
          formattedMax: `${before}${formatCompactNumber(goal)}${after}`,
          value: numericValue,
          formattedValue: `${before}${numericValue.toLocaleString()}${after}`,
          goalIndex: index,
        });
      }

      return;
    }

    if (dataset.data?.length > 1) {
      let currentValue;

      try {
        const currentItems = `${dataset.data[dataset.data.length - 1]}`.match(/-?[\d.]+/g);
        currentValue = parseFloat(currentItems.filter((item) => item !== ".")[0]);
      } catch (error) {
        currentValue = undefined;
      }

      growth.push({
        value: `${before}${currentValue?.toLocaleString() || 0}${after}`,
        comparison: chart.invertGrowth ? -currentValue * 100 : currentValue * 100,
        status: chart.invertGrowth
          ? (currentValue > 0 && "negative") || (currentValue < 0 && "positive") || "neutral"
          : (currentValue > 0 && "positive") || (currentValue < 0 && "negative") || "neutral",
        label: dataset.label,
      });

      if (goal) {
        goals.push({
          max: goal,
          formattedMax: `${before}${formatCompactNumber(goal)}${after}`,
          value: dataset.data[dataset.data.length - 1],
          formattedValue: `${before}${dataset.data[dataset.data.length - 1]}${after}`,
          goalIndex: index,
        });
      }
    }
  });

  return {
    ...configuration,
    growth,
    goals,
  };
}

function frameToChartData({
  chart,
  datasets,
  frame,
}) {
  const axisData = buildAxisData(frame, chart);
  const chartBuilder = selectChartBuilder(chart, datasets, axisData);
  const initialConfiguration = chartBuilder.getConfiguration();
  const sortedConfiguration = applySortAndLimit(chart, initialConfiguration);
  const configuration = buildGrowthAndGoals(chart, sortedConfiguration);

  return {
    isTimeseries: frame.isTimeseries,
    dateFormat: frame.dateFormat,
    configuration,
    conditionsOptions: frame.conditionsOptions,
  };
}

function createMatrixMoment(timezone = "") {
  if (timezone) {
    return (...args) => {
      if (args.length === 0) {
        return momentObj().tz(timezone);
      }

      if (args.length === 1) {
        return momentObj(args[0]).tz(timezone);
      }

      return momentObj.tz(...args, timezone);
    };
  }

  return (...args) => {
    if (args.length === 0) {
      return momentObj.utc();
    }

    return momentObj.utc(...args);
  };
}

function frameToMatrixChartData({
  chart,
  datasets,
  frame,
  timezone = "",
}) {
  if (!frame?.isTimeseries) {
    throw new VizFrameCompatibilityError("Matrix charts require timeseries VizFrame labels.");
  }

  if (!Array.isArray(frame?.series) || frame.series.length === 0) {
    throw new VizFrameCompatibilityError("Matrix charts require at least one VizFrame series.");
  }

  if (frame.series[0].dataMode !== "weekdayHeatmap") {
    throw new VizFrameCompatibilityError("Matrix charts require weekdayHeatmap VizFrame data.");
  }

  const axisData = {
    x: frame.labels.map((label) => label.label),
    y: [frame.series[0].data],
  };
  const matrixChart = new MatrixChart(
    chart,
    datasets,
    axisData,
    frame.dateFormat || "YYYY-MM-DD",
    createMatrixMoment(timezone),
  );
  const configuration = matrixChart.getConfiguration();
  configuration.data.labels = axisData.x;

  return {
    isTimeseries: frame.isTimeseries,
    dateFormat: frame.dateFormat,
    configuration,
    conditionsOptions: frame.conditionsOptions,
  };
}

module.exports = {
  frameToMatrixChartData,
  frameToChartData,
};
