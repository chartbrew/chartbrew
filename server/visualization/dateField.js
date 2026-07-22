function getBindingId(dataset) {
  return dataset?.options?.cdc_id ?? dataset?.options?.id ?? dataset?.bindingId ?? null;
}

function getVisualizationTimeField(visualization, bindingId) {
  const layer = (visualization?.layers || []).find((item) => {
    return `${item.bindingId}` === `${bindingId}` && item.encoding?.time?.field;
  });
  return layer?.encoding?.time?.field || null;
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

function getPreferredSchemaDateField(fieldsSchema = {}) {
  if (!fieldsSchema || typeof fieldsSchema !== "object" || Array.isArray(fieldsSchema)) return null;
  const dateFields = Object.entries(fieldsSchema)
    .filter(([, type]) => type === "date" || type === "temporal")
    .map(([field], index) => ({ field, index, score: getDateFieldScore(field) }))
    .sort((left, right) => left.score - right.score || left.index - right.index);
  return dateFields[0]?.field || null;
}

function resolveDatasetDateField(visualization, dataset) {
  const options = dataset?.options || {};
  return options.dateField
    || getVisualizationTimeField(visualization, getBindingId(dataset))
    || getPreferredSchemaDateField(options.fieldsSchema);
}

module.exports = {
  getPreferredSchemaDateField,
  getVisualizationTimeField,
  resolveDatasetDateField,
};
