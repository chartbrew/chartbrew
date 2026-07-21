export const AGGREGATIONS = [{ id: "none", label: "No aggregation" }, {
  id: "count",
  label: "Count",
}, {
  id: "sum",
  label: "Sum",
}, {
  id: "avg",
  label: "Average",
}, {
  id: "min",
  label: "Minimum",
}, {
  id: "max",
  label: "Maximum",
}];

const METRIC_MARKS = new Set(["kpi", "avg", "gauge"]);
const CATEGORY_MARKS = new Set(["pie", "doughnut", "radar", "polar"]);
const DEFAULT_BAR_FILL_OPACITY = 0.65;
const DEFAULT_LINE_FILL_OPACITY = 0.2;
const DEFAULT_RADAR_FILL_OPACITY = 0.15;

function createLayerId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `layer-${Date.now().toString(36)}`;
}

export function getFieldSemanticType(fieldType) {
  if (fieldType === "date") return "temporal";
  if (fieldType === "number") return "quantitative";
  if (fieldType === "boolean") return "boolean";
  if (fieldType === "object") return "record";
  return "nominal";
}

export function getDimensionRole(layer) {
  return layer?.encoding?.time ? "time" : "category";
}

function getDateFieldScore(field) {
  const name = `${field}`.split(".").pop().replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (name === "createdat" || name === "createddate") return 0;
  if (name.includes("created")) return 1;
  if (name === "timestamp") return 2;
  if (name.includes("timestamp")) return 3;
  if (name.includes("date")) return 4;
  return 5;
}

export function getPreferredDateField(fieldOptions = []) {
  return fieldOptions
    .map((field, index) => ({ ...field, index, score: getDateFieldScore(field.value) }))
    .filter((field) => field.type === "date")
    .sort((left, right) => left.score - right.score || left.index - right.index)[0]?.value || null;
}

export function getVisualizationTimeField(visualization, bindingId) {
  const layer = (visualization?.layers || []).find((item) => {
    return `${item.bindingId}` === `${bindingId}` && item.encoding?.time?.field;
  });
  return layer?.encoding?.time?.field || null;
}

export function getLayerFieldRequirements(mark) {
  if (mark === "table") return { collection: true };
  if (mark === "matrix") return { dimension: true, value: true };
  if (METRIC_MARKS.has(mark)) return { value: true };
  if (CATEGORY_MARKS.has(mark)) {
    return { dimension: true, value: true, breakdown: mark === "radar" };
  }
  return { dimension: true, value: true, breakdown: true };
}

export function isVisualizationReady(visualization) {
  if (!visualization?.layers?.length) return false;
  return visualization.layers.every((layer) => {
    const requirements = getLayerFieldRequirements(layer.mark);
    if (requirements.collection) return Boolean(layer.rowPath);
    if (requirements.dimension && !layer.encoding?.time && !layer.encoding?.category) return false;
    if (requirements.value && !layer.encoding?.value?.field) return false;
    return true;
  });
}

function makeNativeVisualization(visualization) {
  const metadata = { ...(visualization?.metadata || {}) };
  delete metadata.migratedFrom;
  delete metadata.migrationWarnings;
  return {
    version: 2,
    ...visualization,
    metadata: {
      ...metadata,
      createdBy: metadata.createdBy || "visualization-editor",
    },
    layers: (visualization?.layers || []).map((layer) => ({ ...layer })),
  };
}

export function updateVisualizationLayer(visualization, layerId, updater) {
  const nextVisualization = makeNativeVisualization(visualization);
  nextVisualization.layers = nextVisualization.layers.map((layer) => {
    return layer.id === layerId ? updater({ ...layer }) : layer;
  });
  nextVisualization.status = isVisualizationReady(nextVisualization) ? "ready" : "draft";
  return nextVisualization;
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

function getEncodingForMark(layer, mark, markState) {
  const saved = markState[mark];
  if (saved?.encoding) return cloneEncoding(saved.encoding);

  const candidates = getEncodingCandidates(layer, markState);
  if (mark === "table" || mark === "markdown") return {};
  if (METRIC_MARKS.has(mark)) {
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
  if (CATEGORY_MARKS.has(mark)) {
    const source = candidates.find((encoding) => {
      return (encoding.category || encoding.time) && encoding.value;
    }) || {};
    const dimension = source.category || source.time;
    return {
      ...(dimension ? { category: { ...dimension, type: "nominal" } } : {}),
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

export function updateLayerMark(visualization, layerId, mark) {
  return updateVisualizationLayer(visualization, layerId, (layer) => {
    const savedMark = layer.options?.markState?.[mark] || {};
    if (layer.mark === mark) {
      if (
        !["bar", "line", "radar"].includes(mark)
        || (
          Object.prototype.hasOwnProperty.call(savedMark, "fill")
          && Object.prototype.hasOwnProperty.call(savedMark, "fillOpacity")
        )
      ) {
        return layer;
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
  });
}

export function updateBindingFill(visualization, bindingId, { fill, fillOpacity }) {
  const nextVisualization = makeNativeVisualization(visualization);
  const normalizedOpacity = Math.min(1, Math.max(0, Number(fillOpacity)));

  nextVisualization.layers = nextVisualization.layers.map((layer) => {
    if (`${layer.bindingId}` !== `${bindingId}`) return layer;

    const style = {
      ...(layer.style || {}),
      fill: Boolean(fill),
      fillOpacity: Number.isFinite(normalizedOpacity)
        ? normalizedOpacity
        : layer.mark === "bar"
          ? DEFAULT_BAR_FILL_OPACITY
          : layer.mark === "radar"
            ? DEFAULT_RADAR_FILL_OPACITY
            : DEFAULT_LINE_FILL_OPACITY,
      multiFill: false,
    };
    delete style.fillColor;

    const options = { ...(layer.options || {}) };
    options.markState = {
      ...(options.markState || {}),
      [layer.mark]: {
        ...(options.markState?.[layer.mark] || {}),
        fill: style.fill,
        fillOpacity: style.fillOpacity,
      },
    };

    return { ...layer, options, style };
  });
  nextVisualization.status = isVisualizationReady(nextVisualization) ? "ready" : "draft";
  return nextVisualization;
}

export function updateLayerField(visualization, layerId, role, fieldOption) {
  return updateVisualizationLayer(visualization, layerId, (layer) => {
    const encoding = { ...(layer.encoding || {}) };
    const nextLayer = { ...layer };

    if (role === "dimension") {
      delete encoding.category;
      delete encoding.time;
      if (fieldOption) {
        const dimensionRole = fieldOption.type === "date" ? "time" : "category";
        encoding[dimensionRole] = {
          field: fieldOption.value,
          type: getFieldSemanticType(fieldOption.type),
        };
      }
    } else if (fieldOption) {
      encoding[role] = {
        ...(encoding[role] || {}),
        field: fieldOption.value,
        type: role === "value" ? "quantitative" : getFieldSemanticType(fieldOption.type),
      };
    } else {
      delete encoding[role];
    }

    if (role === "value" && fieldOption
      && (!layer.name || /^(Layer|Metric|Value) \d+$/.test(layer.name))) {
      nextLayer.name = fieldOption.text || fieldOption.value;
    }

    return { ...nextLayer, encoding };
  });
}

export function updateLayerAggregation(visualization, layerId, aggregate) {
  return updateVisualizationLayer(visualization, layerId, (layer) => ({
    ...layer,
    encoding: {
      ...layer.encoding,
      value: {
        ...layer.encoding?.value,
        aggregate,
      },
    },
  }));
}

export function updateLayerGoal(visualization, layerId, goal) {
  return updateVisualizationLayer(visualization, layerId, (layer) => ({
    ...layer,
    goal: goal === null || goal === "" ? null : Number(goal),
  }));
}

export function updateLayerFormula(visualization, layerId, formula) {
  return updateVisualizationLayer(visualization, layerId, (layer) => ({
    ...layer,
    encoding: {
      ...layer.encoding,
      value: {
        ...layer.encoding?.value,
        formula: formula || null,
      },
    },
  }));
}

export function updateLayerSeriesOptions(visualization, layerId, changes) {
  return updateVisualizationLayer(visualization, layerId, (layer) => ({
    ...layer,
    options: {
      ...(layer.options || {}),
      series: {
        ...(layer.options?.series || {}),
        ...changes,
      },
    },
  }));
}

export function updateLayerRowPath(visualization, layerId, rowPath) {
  return updateVisualizationLayer(visualization, layerId, (layer) => {
    const nextLayer = { ...layer };

    if (rowPath) {
      nextLayer.rowPath = rowPath;
    } else {
      delete nextLayer.rowPath;
    }

    return nextLayer;
  });
}

export function updateSeriesColor(visualization, layerId, seriesId, color) {
  return updateVisualizationLayer(visualization, layerId, (layer) => {
    const style = { ...(layer.style || {}) };
    const series = { ...(style.series || {}) };

    if (color) {
      series[seriesId] = {
        ...(series[seriesId] || {}),
        color,
        fillColor: color,
      };
    } else {
      delete series[seriesId];
    }

    if (Object.keys(series).length > 0) style.series = series;
    else delete style.series;

    return { ...layer, style };
  });
}

export function addVisualizationLayer(visualization, bindingId, options = {}) {
  const nextVisualization = makeNativeVisualization(visualization);
  const sourceLayer = options.sourceLayer || nextVisualization.layers.find((layer) => {
    return `${layer.bindingId}` === `${bindingId}`;
  });
  const metric = Boolean(options.metric);
  const encoding = metric ? {
    ...(sourceLayer?.encoding?.time ? { time: sourceLayer.encoding.time } : {}),
    ...(sourceLayer?.encoding?.category ? { category: sourceLayer.encoding.category } : {}),
  } : {};
  nextVisualization.layers.push({
    bindingId,
    encoding,
    id: options.id || createLayerId(),
    mark: sourceLayer?.mark || "line",
    name: metric ? `Value ${nextVisualization.layers.length + 1}` : `Layer ${nextVisualization.layers.length + 1}`,
    orientation: "vertical",
    stack: "none",
    style: {},
    transforms: [],
  });
  nextVisualization.status = "draft";
  return nextVisualization;
}

export function removeVisualizationLayer(visualization, layerId) {
  const nextVisualization = makeNativeVisualization(visualization);
  nextVisualization.layers = nextVisualization.layers.filter((layer) => layer.id !== layerId);
  nextVisualization.status = isVisualizationReady(nextVisualization) ? "ready" : "draft";
  return nextVisualization;
}
