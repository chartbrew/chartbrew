const determineType = require("./determineType");

function findFields(coll, currentKey, first, fields) {
  let newFields = fields;
  if (!coll) return newFields;

  Object.keys(coll).map((field) => {
    const data = coll[field];
    let newKey = field;
    if (currentKey) {
      newKey = `${currentKey}.${field}`;
      if (first) {
        newKey = `root.${currentKey}[].${field}`;
      }
      newFields.push({
        field: newKey,
        value: coll[field],
        type: determineType(coll[field]),
      });
    } else {
      if (first) newKey = `root[].${newKey}`;
      newFields.push({
        field: newKey,
        value: coll[field],
        type: determineType(coll[field]),
      });
    }

    if (data !== null && typeof data === "object" && !(data instanceof Array)) {
      newFields = findFields(coll[field], newKey, false, newFields);
    }

    return field;
  });

  return newFields;
}

export default function init(collection) {
  let fields = [];
  const explorationSet = [];

  if (!(collection instanceof Array)) {
    Object.keys(collection).forEach((field) => {
      if (collection[field] instanceof Array) {
        explorationSet.push({
          field,
          value: collection[field],
          type: determineType(collection[field]),
        });
      }
    });
  }

  if (explorationSet.length > 0) {
    for (let i = 0; i < explorationSet.length; i++) {
      fields = findFields(
        collection[explorationSet[i].field][0],
        explorationSet[i].field,
        true,
        fields
      );
    }
  } else {
    fields = findFields(collection[0], "", true, fields);
  }

  return fields;
}
