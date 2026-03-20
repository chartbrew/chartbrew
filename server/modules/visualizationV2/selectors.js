const _ = require("lodash");

function toPlainObject(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (typeof value.toJSON === "function") {
    return value.toJSON();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toPlainObject(item));
  }

  return { ...value };
}

function buildFieldIndex(datasetOptions = {}) {
  const plainDatasetOptions = toPlainObject(datasetOptions) || {};
  const index = new Map();

  if (Array.isArray(plainDatasetOptions.fieldsMetadata)) {
    plainDatasetOptions.fieldsMetadata.forEach((field) => {
      const plainField = toPlainObject(field) || {};
      const keys = [
        plainField.id,
        plainField.legacyPath,
        plainField.field,
      ].filter(Boolean);

      keys.forEach((key) => {
        index.set(key, plainField);
      });
    });
  }

  if (plainDatasetOptions.fieldsSchema && typeof plainDatasetOptions.fieldsSchema === "object") {
    Object.keys(plainDatasetOptions.fieldsSchema).forEach((fieldPath) => {
      if (!index.has(fieldPath)) {
        index.set(fieldPath, {
          id: fieldPath,
          legacyPath: fieldPath,
          type: plainDatasetOptions.fieldsSchema[fieldPath],
        });
      }
    });
  }

  return index;
}

function normalizeSelector(selector) {
  if (!selector) {
    return null;
  }

  if (typeof selector === "string") {
    return {
      fieldId: selector,
    };
  }

  if (typeof selector === "object") {
    return selector;
  }

  return null;
}

function resolveSelector(selector, datasetOptions = {}) {
  const plainDatasetOptions = toPlainObject(datasetOptions) || {};
  const normalizedSelector = normalizeSelector(selector);
  if (!normalizedSelector) {
    return null;
  }

  const selectorKey = normalizedSelector.fieldId
    || normalizedSelector.field
    || normalizedSelector.legacyPath
    || normalizedSelector.ref;

  if (!selectorKey) {
    return null;
  }

  const fieldIndex = buildFieldIndex(plainDatasetOptions);
  const metadata = fieldIndex.get(selectorKey);

  if (metadata) {
    return {
      fieldId: metadata.id || metadata.legacyPath || selectorKey,
      legacyPath: metadata.legacyPath || selectorKey,
      type:
        metadata.type
        || plainDatasetOptions.fieldsSchema?.[metadata.legacyPath]
        || plainDatasetOptions.fieldsSchema?.[selectorKey]
        || normalizedSelector.type
        || null,
      metadata,
    };
  }

  return {
    fieldId: selectorKey,
    legacyPath: selectorKey,
    type: plainDatasetOptions.fieldsSchema?.[selectorKey] || normalizedSelector.type || null,
    metadata: null,
  };
}

function resolveSelectorLegacyPath(selector, datasetOptions = {}) {
  return resolveSelector(selector, datasetOptions)?.legacyPath || null;
}

function parseLegacySelectorPath(selectorPath = "") {
  if (!selectorPath) {
    return null;
  }

  if (selectorPath.indexOf("root[]") > -1) {
    return {
      rawPath: selectorPath,
      collectionPath: null,
      fieldPath: selectorPath.replace("root[].", ""),
      collectionAccessorPath: null,
      isRootArray: true,
    };
  }

  if (!selectorPath.includes("[]")) {
    return {
      rawPath: selectorPath,
      collectionPath: null,
      fieldPath: selectorPath.replace(/^root\./, ""),
      collectionAccessorPath: null,
      isRootArray: false,
    };
  }

  const collectionPath = selectorPath.substring(0, selectorPath.indexOf("]") - 1).replace("root.", "");
  const fieldPath = selectorPath.substring(selectorPath.indexOf("]") + 2);

  return {
    rawPath: selectorPath,
    collectionPath,
    fieldPath,
    collectionAccessorPath: collectionPath,
    isRootArray: false,
  };
}

function compileSelector(selector, datasetOptions = {}) {
  const resolvedSelector = resolveSelector(selector, datasetOptions);
  if (!resolvedSelector?.legacyPath) {
    return null;
  }

  const parsedPath = parseLegacySelectorPath(resolvedSelector.legacyPath);
  if (!parsedPath) {
    return null;
  }

  return {
    ...resolvedSelector,
    ...parsedPath,
  };
}

function getSelectorCollectionItems(datasetData, compiledSelector) {
  if (!compiledSelector) {
    return null;
  }

  if (compiledSelector.isRootArray) {
    return Array.isArray(datasetData) ? datasetData : null;
  }

  if (!compiledSelector.collectionAccessorPath) {
    if (Array.isArray(datasetData)) {
      return datasetData;
    }

    if (datasetData && typeof datasetData === "object") {
      return [datasetData];
    }

    return null;
  }

  const items = _.get(datasetData, compiledSelector.collectionAccessorPath);
  return Array.isArray(items) ? items : null;
}

function getSelectorValue(item, compiledSelector) {
  if (!compiledSelector) {
    return undefined;
  }

  if (!compiledSelector.fieldPath) {
    return item;
  }

  return _.get(item, compiledSelector.fieldPath);
}

module.exports = {
  buildFieldIndex,
  compileSelector,
  getSelectorCollectionItems,
  getSelectorValue,
  parseLegacySelectorPath,
  resolveSelector,
  resolveSelectorLegacyPath,
  toPlainObject,
};
