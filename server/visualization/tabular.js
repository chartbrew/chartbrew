const _ = require("lodash");

function applyLegacyTabularOptions(rows, options = {}) {
  const pairedRows = rows.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const newItem = { ...item };
    (options.groups || []).forEach((group) => {
      let key = _.get(newItem, group.key);
      const value = _.get(newItem, group.value);
      if (key && value && typeof key.replaceAll === "function") {
        key = key.replaceAll(".", " ");
        newItem[`${key}`] = value;
      }
    });
    return newItem;
  });

  const groupBy = options.groupBy?.replace("root[].", "");
  if (!groupBy) return pairedRows;

  const groupedRows = [];
  pairedRows.forEach((item) => {
    const value = _.get(item, groupBy);
    const foundIndex = groupedRows.findIndex((grouped) => _.get(grouped, groupBy) === value);
    if (foundIndex > -1) groupedRows[foundIndex] = { ...groupedRows[foundIndex], ...item };
    else groupedRows.push(item);
  });
  return groupedRows;
}

module.exports = {
  applyLegacyTabularOptions,
};
