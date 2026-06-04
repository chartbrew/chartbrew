const {
  getVariableBinding,
  hasProvidedValue,
} = require("../variables/stringVariables");

function escapeSqlString(value, isAlreadyQuoted, options = {}) {
  const stringValue = String(value);
  const escapedValue = (options.escapeBackslash ? stringValue.replace(/\\/g, "\\\\") : stringValue)
    .replace(/'/g, "''");

  return isAlreadyQuoted
    ? escapedValue.replace(/"/g, "\"\"")
    : `'${escapedValue}'`;
}

function replaceSqlPlaceholder(query, placeholder, value) {
  return query.replace(placeholder, () => value);
}

function formatSqlVariableValue(value, binding, isAlreadyQuoted, options = {}) {
  switch (binding?.type) {
    case "number":
      return Number.isNaN(Number(value)) ? "0" : String(value);
    case "boolean":
      return (value === "true" || value === true) ? "TRUE" : "FALSE";
    case "date":
    case "string":
    default:
      return escapeSqlString(value, isAlreadyQuoted, options);
  }
}

function applySqlVariables(dataRequest, variables = {}, options = {}) {
  const originalDataRequest = dataRequest;

  if (!originalDataRequest.query
    || !originalDataRequest.VariableBindings
    || originalDataRequest.VariableBindings.length === 0
  ) {
    return {
      dataRequest: originalDataRequest,
      processedQuery: originalDataRequest.query,
    };
  }

  let processedQuery = originalDataRequest.query;
  const variableRegex = /\{\{([^}]+)\}\}/g;
  let match;
  const foundVariables = [];

  // oxlint-disable-next-line no-cond-assign
  while ((match = variableRegex.exec(processedQuery)) !== null) {
    const variableName = match[1].trim();
    const startIndex = match.index;
    const endIndex = match.index + match[0].length;
    const beforeChar = startIndex > 0 ? processedQuery[startIndex - 1] : "";
    const afterChar = endIndex < processedQuery.length ? processedQuery[endIndex] : "";
    const isAlreadyQuoted = (beforeChar === "'" && afterChar === "'")
      || (beforeChar === "\"" && afterChar === "\"");

    foundVariables.push({
      placeholder: match[0],
      name: variableName,
      isAlreadyQuoted,
    });
  }

  foundVariables.forEach((variable) => {
    const binding = getVariableBinding(originalDataRequest, variable.name);
    const runtimeValue = variables[variable.name];
    const hasRuntimeValue = hasProvidedValue(runtimeValue);
    const hasDefaultValue = hasProvidedValue(binding?.default_value);

    if (hasRuntimeValue) {
      processedQuery = replaceSqlPlaceholder(
        processedQuery,
        variable.placeholder,
        formatSqlVariableValue(runtimeValue, binding, variable.isAlreadyQuoted, options)
      );
    } else if (hasDefaultValue && binding) {
      processedQuery = replaceSqlPlaceholder(
        processedQuery,
        variable.placeholder,
        formatSqlVariableValue(binding.default_value, binding, variable.isAlreadyQuoted, options)
      );
    } else {
      if (binding?.required) {
        throw new Error(`Required variable '${variable.name}' has no value provided and no default value`);
      }

      processedQuery = processedQuery.replace(variable.placeholder, "");
    }
  });

  return {
    dataRequest: originalDataRequest,
    processedQuery,
  };
}

module.exports = {
  applyMysqlOrPostgresVariables: applySqlVariables,
  applySqlVariables,
};
