import determineType from "./determineType";

function findFields(coll, currentKey, first, fields) {
  let newFields = fields;
  if (!coll) return newFields;
  if (Object.keys(coll).length === 0) return newFields;

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

export default function init(collection, checkObjects) {
  let fields = [];
  const explorationSet = [];

  if (checkObjects) {
    fields = findFields(collection, "", true, fields);
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
      const iterations = collection[explorationSet[i].field].length < 10
        ? collection[explorationSet[i].field].length : 10;
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
        if (fields.findIndex(field => field.field === f.field) === -1) {
          fields.push(f);
        }
      });
    });
  } else {
    const iterations = collection.length < 10 ? collection.length : 10;
    const multiFields = [];
    for (let i = 0; i < iterations; i++) {
      multiFields.push(findFields(collection[i], "", true, []));
    }

    multiFields.forEach((m) => {
      m.forEach((f) => {
        if (fields.findIndex(field => field.field === f.field) === -1) {
          fields.push(f);
        }
      });
    });
  }

  return fields;
}
