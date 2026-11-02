const FORBIDDEN_PATH_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function getVariableValue(variables, name) {
  if (FORBIDDEN_PATH_KEYS.has(name)) return undefined;
  return variables?.[name];
}

function applyStringVariables(value, variables) {
  const exactMatch = value.match(/^\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}$/);
  if (exactMatch) {
    const variable = getVariableValue(variables, exactMatch[1]);
    return variable === undefined ? value : variable;
  }

  return value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, name) => {
    const variable = getVariableValue(variables, name);
    if (variable === undefined || variable === null) return match;
    return typeof variable === "string" ? variable : JSON.stringify(variable);
  });
}

function applyVariablesToValue(value, variables = {}) {
  if (typeof value === "string") return applyStringVariables(value, variables);
  if (Array.isArray(value)) return value.map((item) => applyVariablesToValue(item, variables));
  if (!value || typeof value !== "object") return value;

  return Object.entries(value).reduce((result, [key, child]) => {
    if (!FORBIDDEN_PATH_KEYS.has(key)) {
      result[key] = applyVariablesToValue(child, variables);
    }
    return result;
  }, {});
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function castBindingValue(value, binding) {
  if (binding?.type === "number") {
    const number = Number(value);
    return Number.isNaN(number) ? value : number;
  }
  if (binding?.type === "boolean") return value === true || value === "true";
  return value;
}

function getBoundVariables(dataRequest, variables) {
  return (dataRequest.VariableBindings || []).reduce((result, binding) => {
    if (hasValue(result[binding.name])) return result;
    if (hasValue(binding.default_value)) {
      result[binding.name] = castBindingValue(binding.default_value, binding);
    } else if (binding.required) {
      throw new Error(
        `Required variable '${binding.name}' has no value provided and no default value`
      );
    } else {
      result[binding.name] = "";
    }
    return result;
  }, { ...(variables || {}) });
}

function applyVariables({ dataRequest, variables = {} }) {
  const source = dataRequest?.toJSON ? dataRequest.toJSON() : { ...dataRequest };
  const boundVariables = getBoundVariables(dataRequest, variables);
  return {
    dataRequest,
    processedDataRequest: {
      ...source,
      configuration: applyVariablesToValue(source.configuration || {}, boundVariables),
      Connection: dataRequest.Connection,
      VariableBindings: dataRequest.VariableBindings,
    },
  };
}

module.exports = {
  applyVariables,
  applyVariablesToValue,
};
