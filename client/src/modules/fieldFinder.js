function findFields(coll, currentKey, first, fields) {
  let newFields = fields;
  Object.keys(coll).map((field) => {
    const data = coll[field];
    let newKey = field;
    if (currentKey) {
      newKey = `${currentKey}.${field}`;
      if (first) {
        newKey = `${currentKey}[].${field}`;
      }
      newFields.push(newKey);
    } else {
      if (first) newKey = `root[].${newKey}`;
      newFields.push(newKey);
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
        explorationSet.push(field);
      }
    });
  }

  if (explorationSet.length > 0) {
    for (let i = 0; i < explorationSet.length; i++) {
      fields = findFields(collection[explorationSet[i]][0], explorationSet[i], true, fields);
    }
  } else {
    fields = findFields(collection[0], "", true, fields);
  }

  return fields;
}
