const { selectRows } = require("../fieldPath");
const { applyLegacyTabularOptions } = require("../tabular");
const { applyRowTransforms } = require("../transforms");

function getBindingId(dataset) {
  return dataset?.options?.cdc_id ?? dataset?.options?.id ?? dataset?.bindingId ?? null;
}

function getEncodingSelectors(encoding) {
  return Object.values(encoding || {}).flatMap((definition) => {
    if (Array.isArray(definition)) return definition.map((item) => item.field);
    return definition?.field ? [definition.field] : [];
  });
}

function getUniqueName(configuration, baseName) {
  let name = baseName;
  let suffix = 2;
  while (Object.prototype.hasOwnProperty.call(configuration, name)) {
    name = `${baseName} ${suffix}`;
    suffix += 1;
  }
  return name;
}

function compileTabularExport({ conditionsOptions, datasets, visualization }) {
  const configuration = {};
  const exportedBindings = new Set();

  visualization.layers.forEach((layer, index) => {
    if (layer.bindingId === null || layer.bindingId === undefined) return;
    const bindingKey = `${layer.bindingId}`;
    if (exportedBindings.has(bindingKey)) return;
    const dataset = datasets.find((item) => `${getBindingId(item)}` === `${layer.bindingId}`);
    if (!dataset) return;
    exportedBindings.add(bindingKey);

    const selectors = getEncodingSelectors(layer.encoding);
    const rows = selectRows(dataset.data, selectors, layer.rowPath);
    const layerFilters = (layer.transforms || []).filter((transform) => transform.type === "filter");
    const filteredRows = applyRowTransforms(rows, layerFilters);
    const exportedRows = applyLegacyTabularOptions(filteredRows, dataset.options);
    const baseName = dataset.options?.legend
      || dataset.options?.name
      || layer.name
      || `Dataset ${index + 1}`;
    configuration[getUniqueName(configuration, baseName)] = exportedRows;
  });

  return {
    conditionsOptions,
    configuration,
  };
}

module.exports = {
  compileTabularExport,
};
