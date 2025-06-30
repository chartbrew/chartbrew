const applyMysqlOrPostgresVariables = (dataRequest, variables = {}) => {
  // Don't modify the original dataRequest at all
  const originalDataRequest = dataRequest;

  // If there's no query or no variable bindings, return original with same query
  if (!originalDataRequest.query
    || !originalDataRequest.VariableBindings
    || originalDataRequest.VariableBindings.length === 0
  ) {
    return {
      dataRequest: originalDataRequest,
      processedQuery: originalDataRequest.query
    };
  }

  let processedQuery = originalDataRequest.query;

  // Find all variable placeholders in the query using regex
  const variableRegex = /\{\{([^}]+)\}\}/g;
  let match;
  const foundVariables = [];

  // Extract all variables from the query
  // eslint-disable-next-line no-cond-assign
  while ((match = variableRegex.exec(processedQuery)) !== null) {
    const variableName = match[1].trim();
    foundVariables.push({
      placeholder: match[0],
      name: variableName,
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }

  // Replace variables with their values using priority: runtime > default > error/removal
  foundVariables.forEach((variable) => {
    const binding = originalDataRequest.VariableBindings.find((vb) => vb.name === variable.name);

    // Check for runtime variable value first
    const runtimeValue = variables[variable.name];
    const hasRuntimeValue = runtimeValue !== null && runtimeValue !== undefined && runtimeValue !== "";

    // Check for default value
    const hasDefaultValue = binding?.default_value !== null
      && binding?.default_value !== undefined
      && binding?.default_value !== "";

    if (hasRuntimeValue) {
      // Priority 1: Use runtime value
      let replacementValue = runtimeValue;

      // Handle different data types based on binding type (if available)
      if (binding?.type) {
        switch (binding.type) {
          case "string":
            replacementValue = `'${String(runtimeValue).replace(/'/g, "''")}'`;
            break;
          case "number":
            replacementValue = Number.isNaN(Number(runtimeValue)) ? "0" : String(runtimeValue);
            break;
          case "boolean":
            replacementValue = (runtimeValue === "true" || runtimeValue === true) ? "TRUE" : "FALSE";
            break;
          case "date":
            replacementValue = `'${String(runtimeValue)}'`;
            break;
          default:
            replacementValue = `'${String(runtimeValue).replace(/'/g, "''")}'`;
        }
      } else {
        // No binding type info, treat as string
        replacementValue = `'${String(runtimeValue).replace(/'/g, "''")}'`;
      }

      processedQuery = processedQuery.replace(variable.placeholder, replacementValue);
    } else if (hasDefaultValue && binding) {
      // Priority 2: Use default value
      let replacementValue = binding.default_value;

      switch (binding.type) {
        case "string":
          replacementValue = `'${binding.default_value.replace(/'/g, "''")}'`;
          break;
        case "number":
          replacementValue = Number.isNaN(Number(binding.default_value)) ? "0" : binding.default_value;
          break;
        case "boolean":
          replacementValue = binding.default_value === "true" || binding.default_value === true ? "TRUE" : "FALSE";
          break;
        case "date":
          replacementValue = `'${binding.default_value}'`;
          break;
        default:
          replacementValue = `'${binding.default_value.replace(/'/g, "''")}'`;
      }

      processedQuery = processedQuery.replace(variable.placeholder, replacementValue);
    } else {
      // Priority 3: No runtime value and no default value
      if (binding?.required) {
        // Required variable without value - throw error
        throw new Error(`Required variable '${variable.name}' has no value provided and no default value`);
      }

      // Not required and no value - remove the placeholder
      processedQuery = processedQuery.replace(variable.placeholder, "");
    }
  });

  return {
    dataRequest: originalDataRequest, // Original unchanged
    processedQuery // Query with variables resolved
  };
};

const applyVariables = (dataRequest, variables = {}) => {
  // Check the connection type instead of dataset type
  const connectionType = dataRequest.Connection?.type;

  switch (connectionType) {
    case "mysql":
    case "postgres":
      return applyMysqlOrPostgresVariables(dataRequest, variables);
    default:
      return {
        dataRequest,
        processedQuery: dataRequest.query
      };
  }
};

module.exports = {
  applyVariables,
  applyMysqlOrPostgresVariables,
};
