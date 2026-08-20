const moment = require("moment-timezone");

const { serializeTypedValue } = require("./seriesIdentity");
const { createMoment, expandTimeValues, formatTimeValues } = require("./time");
const { applyValueFormula } = require("./valueFormula");

const CARTESIAN_MARKS = new Set(["area", "bar", "line"]);
const CATEGORY_MARKS = new Set(["doughnut", "pie", "polar", "radar"]);
const METRIC_MARKS = new Set(["avg", "gauge", "kpi"]);

function hasField(result, key) {
  return (result.fields || []).some((field) => field.key === key);
}

function getDimensionRole(result) {
  if (hasField(result, "time")) return "time";
  if (hasField(result, "category")) return "category";
  if (hasField(result, "row")) return "row";
  if (hasField(result, "column")) return "column";
  return null;
}

function getDomain(preparedData) {
  const domain = new Map();

  preparedData.results.forEach((result) => {
    const role = getDimensionRole(result);
    if (!role) return;
    result.rows.forEach((row) => {
      const value = row[role];
      const key = serializeTypedValue(value);
      if (!domain.has(key)) domain.set(key, value);
    });
  });

  return domain;
}

function getLayer(visualization, result) {
  return visualization.layers.find((layer) => `${layer.id}` === `${result.id}`) || {};
}

function buildTimeRange(runtimeContext, values, timeUnit, timezone) {
  const effectiveRange = runtimeContext?.effectiveDateRange;
  const configuredStart = createMoment(effectiveRange?.startDate, timezone);
  const configuredEnd = createMoment(effectiveRange?.endDate, timezone);
  if (configuredStart?.isValid() && configuredEnd?.isValid()) {
    return {
      end: configuredEnd.clone().add(1, "millisecond").toISOString(),
      start: configuredStart.toISOString(),
    };
  }

  const parsed = values
    .map((value) => createMoment(value, timezone))
    .filter((value) => value?.isValid())
    .sort((left, right) => left.valueOf() - right.valueOf());
  if (parsed.length === 0) return null;

  return {
    end: parsed[parsed.length - 1].clone().add(1, timeUnit || "day").toISOString(),
    start: parsed[0].toISOString(),
  };
}

function buildProjectionDomain({
  chart,
  preparedData,
  runtimeContext,
  timezone,
  visualization,
}) {
  const marks = [...new Set(preparedData.results.map((result) => result.mark))];
  const mark = marks[0] || null;
  let domain = getDomain(preparedData);
  const timeResult = preparedData.results.find((result) => hasField(result, "time"));
  const timeLayer = timeResult ? getLayer(visualization, timeResult) : null;
  const timeUnit = timeLayer?.encoding?.time?.timeUnit
    || visualization.settings?.timeInterval
    || chart?.timeInterval
    || "day";

  if (timeResult && CARTESIAN_MARKS.has(mark)) {
    const includeZeros = visualization.settings?.includeZeros ?? chart?.includeZeros;
    const canExpand = !["minute", "second"].includes(timeUnit);
    if (includeZeros && canExpand) {
      const expanded = expandTimeValues(
        [...domain.values()],
        timeUnit,
        timezone,
        runtimeContext?.effectiveDateRange || visualization.settings?.dateWindow || {}
      );
      domain = new Map(expanded.map((value) => [serializeTypedValue(value), value]));
    } else {
      domain = new Map([...domain.entries()].sort((left, right) => left[1] - right[1]));
    }
  }

  const domainValues = [...domain.values()];
  if (mark === "matrix") {
    const labels = domainValues.map((value) => {
      const parsed = moment.utc(value);
      return (timezone ? parsed.tz(timezone) : parsed).format("YYYY-MM-DD");
    });
    return {
      dateFormat: "YYYY-MM-DD",
      domain,
      domainValues,
      labels,
      timeRange: buildTimeRange(runtimeContext, domainValues, timeUnit, timezone),
      timeUnit,
    };
  }

  const formattedTime = timeResult
    ? formatTimeValues(domainValues, timeUnit, timezone)
    : null;
  return {
    dateFormat: formattedTime?.format || "",
    domain,
    domainValues,
    labels: formattedTime?.labels || domainValues,
    timeRange: timeResult
      ? buildTimeRange(runtimeContext, domainValues, timeUnit, timezone)
      : null,
    timeUnit,
  };
}

function buildProjectedSeries(preparedData, visualization, domain, missingValue) {
  const projected = [];

  preparedData.results.forEach((result) => {
    const layer = getLayer(visualization, result);
    const dimensionRole = getDimensionRole(result);
    const valuesBySeries = new Map();

    result.rows.forEach((row) => {
      if (!valuesBySeries.has(row.seriesId)) valuesBySeries.set(row.seriesId, new Map());
      const dimensionKey = dimensionRole ? serializeTypedValue(row[dimensionRole]) : "value";
      valuesBySeries.get(row.seriesId).set(dimensionKey, row.value);
    });

    result.series.forEach((series) => {
      const valuesByDimension = valuesBySeries.get(series.id) || new Map();
      const isCumulative = (layer.transforms || []).some((transform) => {
        return transform.type === "window" && transform.operation === "cumulativeSum";
      });
      const domainKeys = dimensionRole ? [...domain.keys()] : ["value"];
      let cumulativeValue = 0;
      const values = domainKeys.map((key) => {
        if (!valuesByDimension.has(key) && !isCumulative) return missingValue;
        if (valuesByDimension.has(key)) cumulativeValue = valuesByDimension.get(key);
        return applyValueFormula(
          cumulativeValue,
          layer.encoding?.value?.formula,
          { formatted: METRIC_MARKS.has(result.mark) }
        );
      });

      projected.push({
        ...series,
        bindingId: result.bindingId,
        formula: layer.encoding?.value?.formula || null,
        goal: layer.encoding?.breakdown ? null : layer.goal ?? null,
        layerId: result.id,
        layerName: layer.name || null,
        mark: result.mark,
        values,
      });
    });
  });

  return projected;
}

function projectPreparedSeries({
  chart,
  preparedData,
  runtimeContext,
  timezone,
  visualization,
}) {
  const marks = [...new Set(preparedData.results.map((result) => result.mark))];
  const mark = marks[0] || null;
  if (marks.length > 1) {
    throw new Error(`Series projection requires one mark, received: ${marks.join(", ")}`);
  }

  if (![...CARTESIAN_MARKS, ...CATEGORY_MARKS, ...METRIC_MARKS, "matrix"].includes(mark)) {
    return {
      dateFormat: "",
      domain: new Map(),
      domainValues: [],
      labels: [],
      mark,
      series: [],
      timeRange: null,
      timeUnit: null,
    };
  }

  const projectionDomain = METRIC_MARKS.has(mark)
    ? {
      dateFormat: "",
      domain: new Map([["value", "Value"]]),
      domainValues: ["Value"],
      labels: ["Value"],
      timeRange: null,
      timeUnit: null,
    }
    : buildProjectionDomain({
      chart,
      preparedData,
      runtimeContext,
      timezone,
      visualization,
    });
  const missingPolicy = visualization.settings?.missingValues?.policy || "preserve";
  const missingValue = CARTESIAN_MARKS.has(mark) && missingPolicy === "zero" ? 0 : null;

  return {
    ...projectionDomain,
    mark,
    series: buildProjectedSeries(
      preparedData,
      visualization,
      projectionDomain.domain,
      missingValue
    ),
  };
}

module.exports = {
  CARTESIAN_MARKS,
  CATEGORY_MARKS,
  METRIC_MARKS,
  buildProjectedSeries,
  buildProjectionDomain,
  buildTimeRange,
  getDimensionRole,
  getDomain,
  hasField,
  projectPreparedSeries,
};
