const { validateVisualizationSpec } = require("./spec");

const DEFAULT_BAR_FILL_OPACITY = 0.65;
const DEFAULT_LINE_FILL_OPACITY = 0.2;
const DEFAULT_RADAR_FILL_OPACITY = 0.15;

function cloneVisualization(visualization) {
  return JSON.parse(JSON.stringify(visualization));
}

function cloneEncoding(encoding = {}) {
  return Object.entries(encoding).reduce((copy, [role, definition]) => {
    copy[role] = Array.isArray(definition)
      ? definition.map((item) => ({ ...item }))
      : { ...definition };
    return copy;
  }, {});
}

function getEncodingCandidates(layer, markState) {
  return [
    layer.encoding || {},
    ...Object.values(markState).reverse().map((state) => state.encoding || {}),
  ];
}

function getEncodingForMark(layer, mark, markState = layer.options?.markState || {}) {
  const saved = markState[mark];
  if (saved?.encoding) return cloneEncoding(saved.encoding);

  const candidates = getEncodingCandidates(layer, markState);
  if (mark === "table" || mark === "markdown") return {};
  if (["kpi", "avg", "gauge"].includes(mark)) {
    const source = candidates.find((encoding) => encoding.value) || {};
    return source.value ? {
      value: {
        ...source.value,
        ...(mark === "avg" ? { aggregate: "avg" } : {}),
      },
    } : {};
  }
  if (mark === "matrix") {
    const source = candidates.find((encoding) => encoding.time && encoding.value)
      || candidates.find((encoding) => encoding.value)
      || {};
    return {
      ...(source.time ? { time: { ...source.time } } : {}),
      ...(source.value ? { value: { ...source.value } } : {}),
    };
  }
  if (["pie", "doughnut", "polar", "radar"].includes(mark)) {
    const source = candidates.find((encoding) => {
      return (encoding.category || encoding.time) && encoding.value;
    }) || {};
    const category = source.category || source.time;
    return {
      ...(category ? { category: { ...category, type: "nominal" } } : {}),
      ...(source.value ? { value: { ...source.value } } : {}),
      ...(mark === "radar" && source.breakdown
        ? { breakdown: { ...source.breakdown } }
        : {}),
    };
  }

  const source = candidates.find((encoding) => {
    return (encoding.time || encoding.category) && encoding.value;
  }) || candidates.find((encoding) => encoding.value) || {};
  return {
    ...(source.time ? { time: { ...source.time } } : {}),
    ...(source.category ? { category: { ...source.category } } : {}),
    ...(source.value ? { value: { ...source.value } } : {}),
    ...(source.breakdown ? { breakdown: { ...source.breakdown } } : {}),
  };
}

function getStyleForMark(layer, mark, saved = {}) {
  const style = { ...(layer.style || {}) };
  if (Object.prototype.hasOwnProperty.call(saved, "fill")) {
    style.fill = saved.fill;
  } else if (mark === "bar") {
    style.fill = true;
  } else if (mark === "line" || mark === "radar") {
    style.fill = false;
  }
  if (Object.prototype.hasOwnProperty.call(saved, "fillOpacity")) {
    style.fillOpacity = saved.fillOpacity;
  } else if (mark === "bar") {
    style.fillOpacity = DEFAULT_BAR_FILL_OPACITY;
  } else if (mark === "line") {
    style.fillOpacity = DEFAULT_LINE_FILL_OPACITY;
  } else if (mark === "radar") {
    style.fillOpacity = DEFAULT_RADAR_FILL_OPACITY;
  }
  if (mark === "radar") {
    delete style.fillColor;
    style.multiFill = false;
  }
  return style;
}

function updateLayerMark(layer, mark) {
  const savedMark = layer.options?.markState?.[mark] || {};
  if (layer.mark === mark) {
    if (
      !["bar", "line", "radar"].includes(mark)
      || (
        Object.prototype.hasOwnProperty.call(savedMark, "fill")
        && Object.prototype.hasOwnProperty.call(savedMark, "fillOpacity")
      )
    ) {
      return { ...layer };
    }
    return {
      ...layer,
      style: getStyleForMark(layer, mark, savedMark),
    };
  }

  const options = { ...(layer.options || {}) };
  const markState = {
    ...(options.markState || {}),
    [layer.mark]: {
      ...(options.markState?.[layer.mark] || {}),
      encoding: cloneEncoding(layer.encoding),
      ...(layer.style?.fill !== undefined ? { fill: layer.style.fill } : {}),
      ...(layer.style?.fillOpacity !== undefined
        ? { fillOpacity: layer.style.fillOpacity }
        : {}),
      ...(layer.rowPath ? { rowPath: layer.rowPath } : {}),
    },
  };
  options.markState = markState;
  const saved = markState[mark];

  return {
    ...layer,
    encoding: getEncodingForMark(layer, mark, markState),
    mark,
    options,
    rowPath: saved?.rowPath || (mark === "table" ? layer.rowPath || "root[]" : layer.rowPath),
    style: getStyleForMark(layer, mark, saved),
  };
}

function setCumulativeTransform(transforms = [], enabled) {
  const next = transforms.filter((transform) => {
    return transform.type !== "window" || transform.operation !== "cumulativeSum";
  });
  if (!enabled) return next;

  const transform = {
    operation: "cumulativeSum",
    role: "value",
    type: "window",
  };
  const frameTransformIndex = next.findIndex((item) => {
    return item.type === "sort" || item.type === "limit";
  });
  if (frameTransformIndex >= 0) next.splice(frameTransformIndex, 0, transform);
  else next.push(transform);
  return next;
}

function applyChartCompatibilityUpdate(visualization, data = {}) {
  const next = cloneVisualization(visualization);
  const settings = { ...(next.settings || {}) };

  next.layers = next.layers.map((layer) => {
    const mark = data.type || layer.mark;
    const markedLayer = data.type ? updateLayerMark(layer, mark) : layer;
    let orientation = layer.orientation;
    let stack = layer.stack;
    if (data.horizontal !== undefined) {
      orientation = data.horizontal ? "horizontal" : "vertical";
    }
    if (data.stacked !== undefined) {
      stack = data.stacked ? "normal" : "none";
    }
    const transforms = data.subType !== undefined
      ? setCumulativeTransform(
        markedLayer.transforms,
        `${data.subType}`.includes("AddTimeseries")
          && !["table", "matrix", "markdown"].includes(mark)
      )
      : markedLayer.transforms;
    return {
      ...markedLayer,
      ...(data.content !== undefined && mark === "markdown" ? { content: data.content } : {}),
      mark,
      orientation,
      ...(mark === "table" ? { rowPath: layer.rowPath || "root[]" } : {}),
      stack,
      transforms,
    };
  });

  const directSettings = [
    "dashedLastPoint",
    "dataLabels",
    "includeZeros",
    "isLogarithmic",
    "maxValue",
    "minValue",
    "timeInterval",
    "xLabelTicks",
  ];
  directSettings.forEach((field) => {
    if (data[field] !== undefined) settings[field] = data[field];
  });
  if (data.displayLegend !== undefined) settings.legend = { visible: Boolean(data.displayLegend) };
  if (data.startDate !== undefined
    || data.endDate !== undefined
    || data.currentEndDate !== undefined
    || data.fixedStartDate !== undefined
  ) {
    settings.dateWindow = {
      ...(settings.dateWindow || {}),
      ...(data.startDate !== undefined ? { start: data.startDate } : {}),
      ...(data.endDate !== undefined ? { end: data.endDate } : {}),
      ...(data.currentEndDate !== undefined ? { currentEndDate: data.currentEndDate } : {}),
      ...(data.fixedStartDate !== undefined ? { fixedStartDate: data.fixedStartDate } : {}),
    };
  }
  next.settings = settings;
  return next;
}

function replaceTransform(transforms, type, replacement) {
  const nextTransforms = (transforms || []).filter((transform) => transform.type !== type);
  if (replacement) nextTransforms.push(replacement);
  return nextTransforms;
}

function applyCdcCompatibilityUpdate(visualization, bindingId, data = {}) {
  const next = cloneVisualization(visualization);
  let bindingLayerIndex = 0;
  next.layers = next.layers.map((layer) => {
    if (`${layer.bindingId}` !== `${bindingId}`) return layer;
    const isPrimaryBindingLayer = bindingLayerIndex === 0;
    bindingLayerIndex += 1;

    const style = { ...(layer.style || {}) };
    const styleFields = ["datasetColor", "fill", "fillColor", "multiFill", "pointRadius"];
    styleFields.forEach((field) => {
      if (data[field] === undefined) return;
      const styleField = field === "datasetColor" ? "color" : field;
      style[styleField] = data[field];
    });
    const encoding = { ...(layer.encoding || {}) };
    if (data.formula !== undefined && encoding.value) {
      encoding.value = { ...encoding.value, formula: data.formula || null };
    }
    if (data.legend !== undefined && isPrimaryBindingLayer) {
      style.label = data.legend;
      if (encoding.value) {
        encoding.value = { ...encoding.value, title: data.legend };
      }
    }
    const options = { ...(layer.options || {}) };
    if (data.fill !== undefined) {
      options.markState = {
        ...(options.markState || {}),
        [layer.mark]: {
          ...(options.markState?.[layer.mark] || {}),
          fill: data.fill,
        },
      };
    }
    let transforms = layer.transforms || [];
    if (data.sort !== undefined) {
      transforms = replaceTransform(transforms, "sort", data.sort ? {
        direction: data.sort,
        role: "value",
        type: "sort",
      } : null);
    }
    if (data.maxRecords !== undefined) {
      transforms = replaceTransform(transforms, "limit", Number.isInteger(data.maxRecords) ? {
        count: data.maxRecords,
        type: "limit",
      } : null);
    }

    return {
      ...layer,
      encoding,
      ...(data.goal !== undefined && isPrimaryBindingLayer ? { goal: data.goal } : {}),
      ...(data.legend !== undefined && isPrimaryBindingLayer ? { name: data.legend } : {}),
      options: {
        ...options,
        ...(data.columnsOrder !== undefined ? { columnsOrder: data.columnsOrder } : {}),
        ...(data.configuration !== undefined ? { configuration: data.configuration } : {}),
        ...(data.excludedFields !== undefined ? { excludedFields: data.excludedFields } : {}),
      },
      style,
      transforms,
    };
  });
  return next;
}

function removeBindingLayers(visualization, bindingId) {
  const next = cloneVisualization(visualization);
  next.layers = next.layers.filter((layer) => `${layer.bindingId}` !== `${bindingId}`);
  next.status = next.layers.length > 0 ? next.status : "orphan";
  return next;
}

function addBindingLayer(visualization, layer) {
  const next = cloneVisualization(visualization);
  next.layers = Array.isArray(next.layers) ? next.layers : [];

  if (next.layers.some((item) => `${item.bindingId}` === `${layer.bindingId}`)) {
    return next;
  }

  next.layers.push(cloneVisualization(layer));
  const validation = validateVisualizationSpec({
    ...next,
    status: "ready",
  });
  next.status = validation.valid ? "ready" : "draft";
  return next;
}

module.exports = {
  addBindingLayer,
  applyCdcCompatibilityUpdate,
  applyChartCompatibilityUpdate,
  getEncodingForMark,
  removeBindingLayers,
};
