function cloneVisualization(visualization) {
  return JSON.parse(JSON.stringify(visualization));
}

function getEncodingForMark(layer, mark) {
  const encoding = layer.encoding || {};
  if (mark === "table" || mark === "markdown") return {};
  if (["kpi", "avg", "gauge"].includes(mark)) {
    return encoding.value ? {
      value: {
        ...encoding.value,
        ...(mark === "avg" ? { aggregate: "avg" } : {}),
      },
    } : {};
  }
  if (mark === "matrix") {
    return {
      ...(encoding.time ? { time: encoding.time } : {}),
      ...(encoding.value ? { value: encoding.value } : {}),
    };
  }
  if (["pie", "doughnut", "polar", "radar"].includes(mark)) {
    const category = encoding.category || encoding.time;
    return {
      ...(category ? { category: { ...category, type: "nominal" } } : {}),
      ...(encoding.value ? { value: encoding.value } : {}),
      ...(mark === "radar" && encoding.breakdown ? { breakdown: encoding.breakdown } : {}),
    };
  }
  return {
    ...(encoding.time ? { time: encoding.time } : {}),
    ...(encoding.category ? { category: encoding.category } : {}),
    ...(encoding.value ? { value: encoding.value } : {}),
    ...(encoding.breakdown ? { breakdown: encoding.breakdown } : {}),
  };
}

function applyChartCompatibilityUpdate(visualization, data = {}) {
  const next = cloneVisualization(visualization);
  const settings = { ...(next.settings || {}) };

  next.layers = next.layers.map((layer) => {
    const mark = data.type || layer.mark;
    let orientation = layer.orientation;
    let stack = layer.stack;
    if (data.horizontal !== undefined) {
      orientation = data.horizontal ? "horizontal" : "vertical";
    }
    if (data.stacked !== undefined) {
      stack = data.stacked ? "normal" : "none";
    }
    return {
      ...layer,
      ...(data.content !== undefined && mark === "markdown" ? { content: data.content } : {}),
      encoding: data.type ? getEncodingForMark(layer, mark) : layer.encoding,
      mark,
      orientation,
      ...(mark === "table" ? { rowPath: layer.rowPath || "root[]" } : {}),
      stack,
    };
  });

  const directSettings = [
    "currentEndDate",
    "dashedLastPoint",
    "dataLabels",
    "fixedStartDate",
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
  if (data.startDate !== undefined || data.endDate !== undefined) {
    settings.dateWindow = {
      ...(settings.dateWindow || {}),
      ...(data.startDate !== undefined ? { start: data.startDate } : {}),
      ...(data.endDate !== undefined ? { end: data.endDate } : {}),
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
  next.layers = next.layers.map((layer) => {
    if (`${layer.bindingId}` !== `${bindingId}`) return layer;

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
      ...(data.goal !== undefined ? { goal: data.goal } : {}),
      ...(data.legend !== undefined ? { name: data.legend } : {}),
      options: {
        ...(layer.options || {}),
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

module.exports = {
  applyCdcCompatibilityUpdate,
  applyChartCompatibilityUpdate,
  getEncodingForMark,
  removeBindingLayers,
};
