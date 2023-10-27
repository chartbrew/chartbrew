import _ from "lodash";

import determineType from "./determineType";

const maxIterations = 20;

function findFields(coll, currentKey, first, fields, onlyObjects) {
  let newFields = fields;
  if (!coll) return newFields;
  if (Object.keys(coll).length === 0) return newFields;

  // check if coll is a string and if so, don't iterate over it and return it as an array
  if (typeof coll === "string") {
    if (!newFields.find((f) => f.field === currentKey)) {
      newFields.push({
        field: currentKey.substring(0, currentKey.lastIndexOf("[]")),
        value: coll,
        type: "array",
      });
    }
    return newFields;
  }

  if (determineType(coll) === "array" && onlyObjects) {
    return newFields;
  }

  Object.keys(coll).forEach((field) => {
    const data = coll[field];
    let newKey = field;
    if (currentKey) {
      newKey = `${currentKey}.${field}`;
      if (first && !onlyObjects) {
        newKey = `root.${currentKey}[].${field}`;
      }

      const fieldType = determineType(coll[field]);
      const existingField = newFields.find((f) => f.field === newKey);
      if (!existingField || !existingField.type) {
        newFields.push({
          field: newKey,
          value: coll[field],
          type: fieldType,
        });
      }

      // include fields from a nested array (2 levels max!)
      if (fieldType === "array" && newKey.split("[]").length < 3 && !onlyObjects) {
        return findFields(coll[field][0], `${newKey}[]`, false, newFields);
      }
    } else {
      if (first && !onlyObjects) newKey = `root[].${newKey}`;
      else if (first && onlyObjects && `${newKey}` !== `${parseInt(newKey, 10)}`) newKey = `root.${newKey}`;
      const fieldType = determineType(coll[field]);
      if (!newFields.find((f) => f.field === newKey)) {
        newFields.push({
          field: newKey,
          value: coll[field],
          type: fieldType,
        });
      }

      // include fields from a nested array (2 levels max!)
      if (fieldType === "array" && newKey.split("[]").length < 3 && !onlyObjects) {
        return findFields(coll[field][0], `${newKey}[]`, false, newFields);
      }
    }

    if (data !== null && typeof data === "object" && !(data instanceof Array)) {
      newFields = findFields(coll[field], newKey, false, newFields);
    }

    return field;
  });

  return newFields;
}

export default function init(collection, checkObjects, onlyObjects) {
  let fields = [];
  const explorationSet = [];

  if (checkObjects) {
    fields = findFields(collection, "", true, fields);
    return fields;
  }

  if (onlyObjects) {
    fields = findFields(collection, "", true, fields, true);
    return fields;
  }

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
    const multiFields = [];
    for (let i = 0; i < explorationSet.length; i++) {
      const iterations = collection[explorationSet[i].field].length < maxIterations
        ? collection[explorationSet[i].field].length : maxIterations;
      for (let j = 0; j < iterations; j++) {
        multiFields.push(findFields(
          collection[explorationSet[i].field][j],
          explorationSet[i].field,
          true,
          []
        ));
      }
    }

    multiFields.forEach((m) => {
      m.forEach((f) => {
        if (_.findIndex(fields, { field: f.field }) === -1) {
          fields.push(f);
        }
      });
    });
  } else {
    const iterations = collection.length < maxIterations ? collection.length : maxIterations;
    const multiFields = [];
    for (let i = 0; i < iterations; i++) {
      multiFields.push(findFields(collection[i], "", true, []));
    }

    multiFields.forEach((m) => {
      m.forEach((f) => {
        if (_.findIndex(fields, { field: f.field }) === -1) {
          fields.push(f);
        } else if (_.findIndex(fields, { field: f.field, type: undefined }) > -1) {
          // if the field is found, but its type is undefined, then set it
          const index = _.findIndex(fields, { field: f.field, type: undefined });
          fields[index].type = f.type;
        }
      });
    });
  }

  return fields;
}
