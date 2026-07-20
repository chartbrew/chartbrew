const { getFieldValue } = require("./fieldPath");

function isNullish(value) {
  return value === null || value === undefined;
}

function asComparable(value) {
  if (value instanceof Date) return value.getTime();
  return value;
}

function matchesFilter(value, transform) {
  const expected = transform.value;
  const operator = transform.operator || "equals";

  switch (operator) {
    case "equals":
    case "eq":
    case "is":
      return value === expected;
    case "notEquals":
    case "neq":
    case "isNot":
      return value !== expected;
    case "in":
      return Array.isArray(expected) && expected.includes(value);
    case "notIn":
      return Array.isArray(expected) && !expected.includes(value);
    case "contains":
      return Array.isArray(value)
        ? value.includes(expected)
        : String(value ?? "").includes(String(expected ?? ""));
    case "notContains":
      return !matchesFilter(value, { ...transform, operator: "contains" });
    case "gt":
      return asComparable(value) > asComparable(expected);
    case "gte":
      return asComparable(value) >= asComparable(expected);
    case "lt":
      return asComparable(value) < asComparable(expected);
    case "lte":
      return asComparable(value) <= asComparable(expected);
    case "isNull":
      return isNullish(value);
    case "isNotNull":
      return !isNullish(value);
    default:
      throw new Error(`Unsupported visualization filter operator: ${operator}`);
  }
}

function applyRowTransforms(rows, transforms = []) {
  return transforms.reduce((currentRows, transform) => {
    if (transform.type !== "filter") return currentRows;
    if (!transform.field) throw new Error("Visualization filter transform requires a field");

    return currentRows.filter((row) => {
      return matchesFilter(getFieldValue(row, transform.field), transform);
    });
  }, rows);
}

function compareValues(left, right) {
  if (left === right) return 0;
  if (left === null || left === undefined) return 1;
  if (right === null || right === undefined) return -1;
  if (typeof left === "string" && typeof right === "string") return left.localeCompare(right);
  return left < right ? -1 : 1;
}

function applyWindowTransform(rows, transform) {
  if (transform.operation !== "cumulativeSum") {
    throw new Error(`Unsupported visualization window operation: ${transform.operation}`);
  }

  const role = transform.role || "value";
  const partitionRole = transform.partitionBy || "breakdown";
  const totals = new Map();

  return rows.map((row) => {
    const partition = row[partitionRole] ?? "__all__";
    const numericValue = Number(row[role]);
    const nextValue = (totals.get(partition) || 0)
      + (Number.isFinite(numericValue) ? numericValue : 0);
    totals.set(partition, nextValue);
    return {
      ...row,
      [role]: nextValue,
    };
  });
}

function applyFrameTransforms(rows, transforms = []) {
  return transforms.reduce((currentRows, transform) => {
    if (transform.type === "window") {
      return applyWindowTransform(currentRows, transform);
    }

    if (transform.type === "sort") {
      const role = transform.role || transform.field;
      if (!role) throw new Error("Visualization sort transform requires a role");
      const direction = transform.direction === "desc" ? -1 : 1;
      return [...currentRows].sort((left, right) => {
        return compareValues(left[role], right[role]) * direction;
      });
    }

    if (transform.type === "limit") {
      const count = Number(transform.count);
      if (!Number.isInteger(count) || count < 0) {
        throw new Error("Visualization limit transform requires a non-negative integer count");
      }
      return currentRows.slice(0, count);
    }

    return currentRows;
  }, rows);
}

module.exports = {
  applyFrameTransforms,
  applyWindowTransform,
  applyRowTransforms,
  matchesFilter,
};
