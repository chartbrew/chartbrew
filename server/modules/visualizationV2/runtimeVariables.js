const {
  buildVisualizationVariableContext,
  collectScopedFilterVariables,
} = require("./variableResolution");

function mergeCdcRuntimeVariables(variables = {}, cdc = {}, options = {}) {
  const filterVariables = collectScopedFilterVariables(options.filters, {
    chart: options.chart || null,
    cdc,
    datasetOptions: options.datasetOptions || null,
  });

  return buildVisualizationVariableContext({
    variables,
    filterVariables,
    cdc,
    datasetOptions: options.datasetOptions || null,
  }).values;
}

module.exports = {
  mergeCdcRuntimeVariables,
};
