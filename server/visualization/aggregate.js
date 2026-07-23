const { serializeTypedValue } = require("./seriesIdentity");

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function createMeasureState() {
  return {
    count: 0,
    last: null,
    max: null,
    min: null,
    numericCount: 0,
    sum: 0,
    uniqueValues: new Set(),
  };
}

function updateMeasureState(state, value) {
  if (value !== null && value !== undefined) {
    state.count += 1;
    state.last = value;
    state.uniqueValues.add(serializeTypedValue(value));
  }

  const numericValue = toFiniteNumber(value);
  if (numericValue === null) return;

  state.numericCount += 1;
  state.sum += numericValue;
  state.min = state.min === null ? numericValue : Math.min(state.min, numericValue);
  state.max = state.max === null ? numericValue : Math.max(state.max, numericValue);
}

function finalizeMeasure(state, operation) {
  switch (operation) {
    case "count":
      return state.count;
    case "count_unique":
      return state.uniqueValues.size;
    case "sum":
      return state.numericCount > 0 ? state.sum : null;
    case "avg":
      return state.numericCount > 0 ? state.sum / state.numericCount : null;
    case "min":
      return state.min;
    case "max":
      return state.max;
    case "none":
    default:
      return state.last;
  }
}

function buildGroupKey(row, dimensionRoles) {
  if (dimensionRoles.length === 0) return "__all__";
  return dimensionRoles.map((role) => serializeTypedValue(row[role])).join("|");
}

function aggregateRows(rows, dimensionRoles, measureEncodings) {
  const groups = new Map();
  const measureRoles = Object.keys(measureEncodings);

  rows.forEach((row) => {
    const key = buildGroupKey(row, dimensionRoles);
    let group = groups.get(key);

    if (!group) {
      group = {
        dimensions: dimensionRoles.reduce((values, role) => {
          values[role] = row[role];
          return values;
        }, {}),
        measures: measureRoles.reduce((values, role) => {
          values[role] = createMeasureState();
          return values;
        }, {}),
        sourceRowCount: 0,
      };
      groups.set(key, group);
    }

    group.sourceRowCount += 1;
    measureRoles.forEach((role) => {
      updateMeasureState(group.measures[role], row[role]);
    });
  });

  return [...groups.values()].map((group) => {
    const aggregated = {
      ...group.dimensions,
      __sourceRowCount: group.sourceRowCount,
    };

    measureRoles.forEach((role) => {
      const operation = measureEncodings[role].aggregate || "none";
      aggregated[role] = finalizeMeasure(group.measures[role], operation);
    });

    return aggregated;
  });
}

module.exports = {
  aggregateRows,
  toFiniteNumber,
};
