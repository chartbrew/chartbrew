const { getMap } = require("../geo");
const { toFiniteNumber } = require("../aggregate");
const { applyValueFormula, parseValueFormula } = require("../valueFormula");
const { geometry } = require("../../../shared/visualization/responsiveLayout.json");

function getMapRows(preparedData, visualization) {
  const layer = visualization.layers[0];
  const formula = layer.encoding.value?.formula;
  const map = getMap(layer.options?.map?.area);
  const points = layer.options?.map?.mode === "points";
  return preparedData.results[0].rows.map((row) => ({
    ...row,
    name: (!points && map.names.get(row.location)) || row.location || `${row.latitude}, ${row.longitude}`,
    value: applyValueFormula(toFiniteNumber(row.value), formula),
  }));
}

function buildMapOption({ chart, preparedData, visualization, renderContext }) {
  const layer = visualization.layers[0];
  const points = layer.options?.map?.mode === "points";
  const map = getMap(layer.options?.map?.area);
  const rows = getMapRows(preparedData, visualization);
  const values = rows.map((row) => row.value).filter((value) => typeof value === "number" && Number.isFinite(value));
  const min = values.reduce((value, next) => Math.min(value, next), 0);
  const max = values.reduce((value, next) => Math.max(value, next), 0) || 1;
  const formula = parseValueFormula(layer.encoding.value?.formula);
  const dark = renderContext.theme === "dark";
  const color = layer.style?.color || "#048BDE";
  const defaultLowColor = dark ? "#173b53" : "#d9eefe";
  const lowColor = typeof layer.style?.fillColor === "string" && layer.style.fillColor
    ? layer.style.fillColor : defaultLowColor;
  const showLegend = (visualization.settings?.legend?.visible ?? chart?.displayLegend ?? true)
    && values.length > 0;
  const label = layer.encoding.value ? layer.name || layer.encoding.value.title || "Value" : "Count";
  const data = rows.map((row) => {
    let longitude = row.longitude;
    if (map.definition.wrap === "west" && longitude > 0) longitude -= 360;
    if (map.definition.wrap === "east" && longitude < 0) longitude += 360;
    return {
      name: points ? row.name : row.location,
      locationLabel: row.name,
      formattedValue: typeof row.value === "number"
        ? `${formula.prefix}${row.value.toLocaleString(renderContext.locale)}${formula.suffix}`
        : "No data",
      value: points ? [longitude, row.latitude, row.value] : row.value,
    };
  });
  if (!points) {
    const present = new Set(data.map((row) => row.name));
    for (const [code, name] of map.names) {
      if (map.included.has(code) && !present.has(code)) {
        data.push({ name: code, locationLabel: name, value: null, formattedValue: "No data" });
      }
    }
  }
  const geography = {
    map: map.definition.id,
    ...({
      europe: { boundingCoords: [[-25, 72], [50, 34]] },
      asia: { boundingCoords: [[25, 80], [180, -12]] },
      "north-america": { boundingCoords: [[-180, 85], [-12, 5]] },
      oceania: { boundingCoords: [[110, 5], [180, -50]] },
    }[map.definition.id] || {}),
    clip: false,
    preserveAspect: "contain",
    nameProperty: "code",
    roam: true,
    roamTrigger: "global",
    scaleLimit: { min: 1, max: 20 },
    left: 8,
    right: 8,
    top: 8,
    bottom: showLegend ? 36 : 8,
    label: { show: false },
    itemStyle: { areaColor: dark ? "#27272a" : "#f4f4f5", borderColor: dark ? "#52525b" : "#d4d4d8", borderWidth: 0.5 },
    emphasis: { label: { show: false }, itemStyle: { borderColor: color, borderWidth: 1 } },
    select: { disabled: true },
  };
  return {
    animation: false,
    aria: { enabled: true },
    tooltip: { trigger: "item", confine: true },
    textStyle: { fontFamily: "Inter, sans-serif", fontSize: 11 },
    visualMap: {
      show: showLegend,
      type: "continuous", min, max, dimension: points ? 2 : 0,
      orient: "horizontal", left: "center", bottom: 0,
      text: [max, min].map((value) => `${formula.prefix}${value.toLocaleString(renderContext.locale)}${formula.suffix}`),
      itemWidth: 10, itemHeight: 100, precision: 2,
      calculable: false,
      inRange: points ? { color: [color, color], symbolSize: [6, 24] } : { color: [lowColor, color] },
      textStyle: { color: dark ? "#e4e4e7" : "#3f3f46" },
    },
    ...(points ? { geo: geography } : {}),
    series: [{
      id: layer.id, name: label, type: points ? "scatter" : "map",
      ...(points ? { coordinateSystem: "geo", symbolSize: 8, itemStyle: { color, opacity: 0.85 } } : geography),
      data,
    }],
    media: showLegend ? [{
      query: { minWidth: geometry.width.regularMax + 1, minHeight: geometry.height.shallowMax + 1, minAspectRatio: 1.5 },
      option: {
        visualMap: { orient: "vertical", left: "auto", right: 8, top: "center", bottom: "auto" },
        ...(points ? { geo: { right: 80, bottom: 8 } } : { series: [{ id: layer.id, right: 80, bottom: 8 }] }),
      },
    }, {
      option: {
        visualMap: { orient: "horizontal", left: "center", right: "auto", top: "auto", bottom: 0 },
        ...(points ? { geo: { right: 8, bottom: 36 } } : { series: [{ id: layer.id, right: 8, bottom: 36 }] }),
      },
    }] : [],
  };
}

module.exports = { buildMapOption, getMapRows };
