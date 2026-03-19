function mergeCdcRuntimeVariables(variables = {}, cdc = {}) {
  const mergedVariables = { ...(variables || {}) };
  const configuredVariables = Array.isArray(cdc?.configuration?.variables)
    ? cdc.configuration.variables
    : [];

  configuredVariables.forEach((configVar) => {
    if (
      mergedVariables[configVar.name] === undefined
      || mergedVariables[configVar.name] === null
      || mergedVariables[configVar.name] === ""
    ) {
      mergedVariables[configVar.name] = configVar.value;
    }
  });

  return mergedVariables;
}

module.exports = {
  mergeCdcRuntimeVariables,
};
