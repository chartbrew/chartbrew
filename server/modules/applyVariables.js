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

const applyMongoVariables = (dataRequest, variables = {}) => {
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
            // For MongoDB, strings need to be properly quoted
            replacementValue = `"${String(runtimeValue).replace(/"/g, "\\\"")}"`;
            break;
          case "number":
            replacementValue = Number.isNaN(Number(runtimeValue)) ? "0" : Number(runtimeValue);
            break;
          case "boolean":
            replacementValue = (runtimeValue === "true" || runtimeValue === true) ? "true" : "false";
            break;
          case "date":
            // For MongoDB dates, we can use ISODate or just a string
            replacementValue = `"${String(runtimeValue)}"`;
            break;
          default:
            replacementValue = `"${String(runtimeValue).replace(/"/g, "\\\"")}"`;
        }
      } else {
        // No binding type info, treat as string
        replacementValue = `"${String(runtimeValue).replace(/"/g, "\\\"")}"`;
      }

      processedQuery = processedQuery.replace(variable.placeholder, replacementValue);
    } else if (hasDefaultValue && binding) {
      // Priority 2: Use default value
      let replacementValue = binding.default_value;

      switch (binding.type) {
        case "string":
          replacementValue = `"${binding.default_value.replace(/"/g, "\\\"")}"`;
          break;
        case "number":
          replacementValue = Number.isNaN(Number(binding.default_value)) ? "0" : Number(binding.default_value);
          break;
        case "boolean":
          replacementValue = binding.default_value === "true" || binding.default_value === true ? "true" : "false";
          break;
        case "date":
          replacementValue = `"${binding.default_value}"`;
          break;
        default:
          replacementValue = `"${binding.default_value.replace(/"/g, "\\\"")}"`;
      }

      processedQuery = processedQuery.replace(variable.placeholder, replacementValue);
    } else {
      // Priority 3: No runtime value and no default value
      if (binding?.required) {
        // Required variable without value - throw error
        throw new Error(`Required variable '${variable.name}' has no value provided and no default value`);
      }

      // Not required and no value - remove the placeholder
      processedQuery = processedQuery.replace(variable.placeholder, "\"\"");
    }
  });

  return {
    dataRequest: originalDataRequest, // Original unchanged
    processedQuery // Query with variables resolved
  };
};

const applyApiVariables = (dataRequest, variables = {}) => {
  // Don't modify the original dataRequest at all
  const originalDataRequest = dataRequest;

  // If there's no variable bindings, return original unchanged
  if (!originalDataRequest.VariableBindings
    || originalDataRequest.VariableBindings.length === 0
  ) {
    return {
      dataRequest: originalDataRequest,
      processedRoute: originalDataRequest.route,
      processedHeaders: originalDataRequest.headers,
      processedBody: originalDataRequest.body
    };
  }

  // Helper function to process variables in a string
  const processVariablesInString = (str) => {
    if (!str || typeof str !== "string") return str;

    const variableRegex = /\{\{([^}]+)\}\}/g;
    let match;
    const foundVariables = [];

    // Extract all variables from the string
    // eslint-disable-next-line no-cond-assign
    while ((match = variableRegex.exec(str)) !== null) {
      const variableName = match[1].trim();
      foundVariables.push({
        placeholder: match[0],
        name: variableName,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    let processedStr = str;

    // Replace variables with their values using priority: runtime > default > error/removal
    foundVariables.forEach((variable) => {
      // Skip reserved date variables - they're handled separately
      if (variable.name === "start_date" || variable.name === "end_date") {
        return;
      }

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
              replacementValue = String(runtimeValue);
              break;
            case "number":
              replacementValue = Number.isNaN(Number(runtimeValue)) ? "0" : String(runtimeValue);
              break;
            case "boolean":
              replacementValue = (runtimeValue === "true" || runtimeValue === true) ? "true" : "false";
              break;
            case "date":
              replacementValue = String(runtimeValue);
              break;
            default:
              replacementValue = String(runtimeValue);
          }
        } else {
          // No binding type info, treat as string
          replacementValue = String(runtimeValue);
        }

        processedStr = processedStr.replace(variable.placeholder, replacementValue);
      } else if (hasDefaultValue && binding) {
        // Priority 2: Use default value
        let replacementValue = binding.default_value;

        switch (binding.type) {
          case "string":
            replacementValue = String(binding.default_value);
            break;
          case "number":
            replacementValue = Number.isNaN(Number(binding.default_value)) ? "0" : String(binding.default_value);
            break;
          case "boolean":
            replacementValue = binding.default_value === "true" || binding.default_value === true ? "true" : "false";
            break;
          case "date":
            replacementValue = String(binding.default_value);
            break;
          default:
            replacementValue = String(binding.default_value);
        }

        processedStr = processedStr.replace(variable.placeholder, replacementValue);
      } else {
        // Priority 3: No runtime value and no default value
        if (binding?.required) {
          // Required variable without value - throw error
          throw new Error(`Required variable '${variable.name}' has no value provided and no default value`);
        }

        // Not required and no value - remove the placeholder
        processedStr = processedStr.replace(variable.placeholder, "");
      }
    });

    return processedStr;
  };

  // Process route/URL
  const processedRoute = processVariablesInString(originalDataRequest.route);

  // Process headers
  let processedHeaders = originalDataRequest.headers;
  if (processedHeaders && typeof processedHeaders === "object") {
    processedHeaders = {};
    Object.keys(originalDataRequest.headers).forEach((key) => {
      const processedKey = processVariablesInString(key);
      const processedValue = processVariablesInString(originalDataRequest.headers[key]);
      processedHeaders[processedKey] = processedValue;
    });
  }

  // Process body
  const processedBody = processVariablesInString(originalDataRequest.body);

  return {
    dataRequest: originalDataRequest, // Original unchanged
    processedRoute,
    processedHeaders,
    processedBody
  };
};

const applyFirestoreVariables = (dataRequest, variables = {}) => {
  // Don't modify the original dataRequest at all
  const originalDataRequest = dataRequest;

  // If there's no variable bindings, return original unchanged
  if (!originalDataRequest.VariableBindings
    || originalDataRequest.VariableBindings.length === 0
  ) {
    return {
      dataRequest: originalDataRequest,
      processedDataRequest: originalDataRequest
    };
  }

  // Convert Sequelize model to plain object if needed
  let plainDataRequest = originalDataRequest;
  if (originalDataRequest.dataValues) {
    // It's a Sequelize model instance, convert to plain object
    plainDataRequest = originalDataRequest.toJSON
      ? originalDataRequest.toJSON() : originalDataRequest.dataValues;
    // Preserve the VariableBindings and Connection from the original request
    plainDataRequest.VariableBindings = originalDataRequest.VariableBindings;
    plainDataRequest.Connection = originalDataRequest.Connection;
  }

  // Helper function to process variables in a string
  const processVariablesInString = (str) => {
    if (!str || typeof str !== "string") return str;

    const variableRegex = /\{\{([^}]+)\}\}/g;
    let match;
    let processedStr = str;

    // Extract all variables from the string
    // eslint-disable-next-line no-cond-assign
    while ((match = variableRegex.exec(str)) !== null) {
      const variableName = match[1].trim();
      const binding = originalDataRequest.VariableBindings
        .find((vb) => vb.name === variableName);

      // Check for runtime variable value first
      const runtimeValue = variables[variableName];
      const hasRuntimeValue = runtimeValue !== null && runtimeValue !== undefined && runtimeValue !== "";

      // Check for default value
      const hasDefaultValue = binding?.default_value !== null
        && binding?.default_value !== undefined
        && binding?.default_value !== "";

      let replacementValue;
      if (hasRuntimeValue) {
        // Priority 1: Use runtime value
        replacementValue = runtimeValue;

        // Handle different data types based on binding type
        if (binding?.type) {
          switch (binding.type) {
            case "number":
              replacementValue = Number.isNaN(Number(runtimeValue))
                ? 0 : Number(runtimeValue);
              break;
            case "boolean":
              replacementValue = (runtimeValue === "true" || runtimeValue === true);
              break;
            case "date":
              replacementValue = String(runtimeValue);
              break;
            default:
              replacementValue = String(runtimeValue);
          }
        } else {
          replacementValue = String(runtimeValue);
        }
      } else if (hasDefaultValue && binding) {
        // Priority 2: Use default value
        replacementValue = binding.default_value;

        switch (binding.type) {
          case "number":
            replacementValue = Number.isNaN(Number(binding.default_value))
              ? 0 : Number(binding.default_value);
            break;
          case "boolean":
            replacementValue = binding.default_value === "true" || binding.default_value === true;
            break;
          case "date":
            replacementValue = String(binding.default_value);
            break;
          default:
            replacementValue = String(binding.default_value);
        }
      } else {
        // Priority 3: No runtime value and no default value
        if (binding?.required) {
          // Required variable without value - throw error
          throw new Error(`Required variable '${variableName}' has no value provided and no default value`);
        }

        // Not required and no value - remove the placeholder
        replacementValue = "";
      }

      processedStr = processedStr.replace(match[0], replacementValue);
    }

    return processedStr;
  };

  // Process variables in the main query (collection path)
  const processedDataRequest = { ...plainDataRequest };
  processedDataRequest.query = processVariablesInString(plainDataRequest.query);

  // Process variables in condition values
  if (processedDataRequest.conditions) {
    processedDataRequest.conditions = processedDataRequest.conditions.map((condition) => {
      if (condition.value && typeof condition.value === "string") {
        const processedCondition = {
          ...condition,
          value: processVariablesInString(condition.value)
        };
        return processedCondition;
      }
      return condition;
    });
  }

  // Process variables in configuration fields
  if (processedDataRequest.configuration) {
    processedDataRequest.configuration = { ...processedDataRequest.configuration };

    // Process selectedSubCollection field (collection name)
    if (processedDataRequest.configuration.selectedSubCollection) {
      processedDataRequest.configuration.selectedSubCollection = processVariablesInString(
        processedDataRequest.configuration.selectedSubCollection
      );
    }

    // Process orderBy field (field name)
    if (processedDataRequest.configuration.orderBy) {
      processedDataRequest.configuration.orderBy = processVariablesInString(
        processedDataRequest.configuration.orderBy
      );
    }

    // Process limit field (convert to number after processing)
    if (processedDataRequest.configuration.limit) {
      const processedLimit = processVariablesInString(
        String(processedDataRequest.configuration.limit),
      );
      processedDataRequest.configuration.limit = parseInt(processedLimit, 10) || 0;
    }
  }

  return {
    dataRequest: originalDataRequest, // Original unchanged
    processedDataRequest // DataRequest with variables resolved
  };
};

const applyVariables = (dataRequest, variables = {}) => {
  // Check the connection type instead of dataset type
  const connectionType = dataRequest.Connection?.type;

  switch (connectionType) {
    case "mysql":
    case "postgres":
      return applyMysqlOrPostgresVariables(dataRequest, variables);
    case "mongodb":
      return applyMongoVariables(dataRequest, variables);
    case "api":
      return applyApiVariables(dataRequest, variables);
    case "firestore":
      return applyFirestoreVariables(dataRequest, variables);
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
  applyMongoVariables,
  applyApiVariables,
  applyFirestoreVariables,
};
