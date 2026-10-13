const { getFieldValue } = require("./fieldPath");

function getCoordinate(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function projectScatterRows(rows, layer) {
  const projected = [];
  let invalidRows = 0;
  if (!layer.encoding.x || !layer.encoding.y) return { projected, warnings: [] };

  rows.forEach((row) => {
    const x = getCoordinate(getFieldValue(row, layer.encoding.x.field));
    const y = getCoordinate(getFieldValue(row, layer.encoding.y.field));
    if (x === null || y === null) {
      invalidRows += 1;
      return;
    }
    projected.push({ x, y, __sourceRowCount: 1 });
  });

  return {
    projected,
    warnings: invalidRows ? [{
      code: "INVALID_SCATTER_COORDINATES",
      count: invalidRows,
      message: `${invalidRows} rows have missing or invalid X or Y values. Select numeric fields or correct the source data.`,
    }] : [],
  };
}

module.exports = { projectScatterRows };
