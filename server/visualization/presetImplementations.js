const { buildEChartsOption } = require("./compilers/echarts");
const { getPresetDefinition } = require("./registry");

function validatePresetInput(presetId, preparedData, visualization) {
  const preset = getPresetDefinition(presetId);
  if (!preset || preset.releaseState !== "ready") {
    throw new Error(`Preset is not ready: ${presetId}`);
  }
  const resultMarks = new Set((preparedData.results || []).map((result) => result.mark));
  if (resultMarks.size !== 1 || !resultMarks.has(preset.mark)) {
    throw new Error(`PreparedData does not match preset: ${presetId}`);
  }
  const layerMarks = new Set((visualization.layers || []).map((layer) => layer.mark));
  if (layerMarks.size !== 1 || !layerMarks.has(preset.mark)) {
    throw new Error(`Visualization does not match preset: ${presetId}`);
  }
  return true;
}

function echartsImplementation(presetId) {
  return Object.freeze({
    compile(input) {
      validatePresetInput(presetId, input.preparedData, input.visualization);
      return buildEChartsOption(input);
    },
    renderer: "echarts",
    validate(input) {
      return validatePresetInput(presetId, input.preparedData, input.visualization);
    },
  });
}

function nativeImplementation(presetId) {
  return Object.freeze({
    compile: null,
    renderer: "native",
    validate(input) {
      return validatePresetInput(presetId, input.preparedData, input.visualization);
    },
  });
}

const SERVER_PRESET_IMPLEMENTATIONS = Object.freeze({
  line: echartsImplementation("line"),
  area: echartsImplementation("area"),
  bar: echartsImplementation("bar"),
  horizontalBar: echartsImplementation("horizontalBar"),
  pie: echartsImplementation("pie"),
  doughnut: echartsImplementation("doughnut"),
  radar: echartsImplementation("radar"),
  polar: echartsImplementation("polar"),
  matrix: echartsImplementation("matrix"),
  gauge: echartsImplementation("gauge"),
  kpi: nativeImplementation("kpi"),
  avg: nativeImplementation("avg"),
  table: nativeImplementation("table"),
  markdown: nativeImplementation("markdown"),
});

function getServerPresetImplementation(presetId) {
  return SERVER_PRESET_IMPLEMENTATIONS[presetId] || null;
}

module.exports = {
  SERVER_PRESET_IMPLEMENTATIONS,
  getServerPresetImplementation,
  validatePresetInput,
};
