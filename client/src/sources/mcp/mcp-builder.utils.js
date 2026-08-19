const LONG_TEXT_FIELDS = new Set(["query", "sql", "hogql", "statement", "context", "prompt"]);

export function getSchemaType(schema = {}) {
  if (Array.isArray(schema.type)) return schema.type.find((type) => type !== "null") || "string";
  return schema.type || (schema.properties ? "object" : "string");
}

export function getSchemaDefault(schema = {}) {
  if (schema.default !== undefined) return schema.default;
  if (getSchemaType(schema) !== "object") return undefined;
  const value = Object.entries(schema.properties || {}).reduce((result, [name, childSchema]) => {
    const childDefault = getSchemaDefault(childSchema);
    if (childDefault !== undefined) result[name] = childDefault;
    return result;
  }, {});
  return Object.keys(value).length ? value : undefined;
}

export function isLongTextField(name, schema) {
  if (getSchemaType(schema) !== "string") return false;
  if (LONG_TEXT_FIELDS.has(String(name).toLowerCase())) return true;
  return Number(schema.maxLength) > 200;
}

export function hasFormFields(schema = {}) {
  const properties = schema?.properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) return false;
  return Object.keys(properties).length > 0;
}

export function getFieldTypeLabel(schema = {}, name = "") {
  if (Array.isArray(schema.enum)) return "enum";
  const type = getSchemaType(schema);
  if (type === "boolean") return "boolean";
  if (type === "integer" || type === "number") return "number";
  if (type === "array") return "array";
  if (type === "object") return "object";
  if (isLongTextField(name, schema)) return "text";
  return "string";
}

export function getSchemaExample(schema = {}, depth = 0) {
  if (depth > 8) return null;
  if (schema.default !== undefined) return schema.default;
  if (schema.example !== undefined) return schema.example;
  if (Array.isArray(schema.examples) && schema.examples.length > 0) return schema.examples[0];
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  const type = getSchemaType(schema);
  if (type === "boolean") return false;
  if (type === "integer" || type === "number") {
    return Number.isFinite(schema.minimum) ? schema.minimum : 0;
  }
  if (type === "array") {
    if (!schema.items) return [];
    const item = getSchemaExample(schema.items, depth + 1);
    return item === undefined ? [] : [item];
  }
  if (type === "object" || schema.properties) {
    return Object.entries(schema.properties || {}).reduce((result, [name, childSchema]) => {
      result[name] = getSchemaExample(childSchema, depth + 1);
      return result;
    }, {});
  }
  if (type === "null") return null;
  return "";
}

export function partitionFields(schema = {}) {
  const required = schema.required || [];
  const long = [];
  const main = [];
  const extra = [];
  Object.entries(schema.properties || {}).forEach(([name, fieldSchema]) => {
    const isRequired = required.includes(name);
    if (isLongTextField(name, fieldSchema)) long.push([name, fieldSchema, isRequired]);
    else if (isRequired) main.push([name, fieldSchema, true]);
    else extra.push([name, fieldSchema, false]);
  });
  long.sort(([left], [right]) => {
    const rank = (name) => (["query", "sql", "hogql"].includes(name.toLowerCase()) ? 0 : 1);
    return rank(left) - rank(right);
  });
  if (main.length === 0 && long.length === 0 && extra.length > 0) {
    return { extra: [], long, main: extra };
  }
  return { extra, long, main };
}
