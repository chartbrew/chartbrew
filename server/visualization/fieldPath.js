const _ = require("lodash");

class FieldPathError extends Error {
  constructor(message, selector) {
    super(message);
    this.name = "FieldPathError";
    this.selector = selector;
  }
}

function stripRoot(path) {
  if (path === "root") return "";
  if (path.startsWith("root.")) return path.slice(5);
  return path;
}

function parseFieldPath(selector) {
  if (typeof selector !== "string" || selector.trim().length === 0) {
    throw new FieldPathError("Field selector must be a non-empty string", selector);
  }

  const normalizedSelector = selector.trim();
  const arrayMarkers = normalizedSelector.match(/\[\]/g) || [];
  if (arrayMarkers.length > 1) {
    throw new FieldPathError(
      "Field selectors with multiple array levels require an explicit flatten transform",
      normalizedSelector
    );
  }

  const arrayIndex = normalizedSelector.indexOf("[]");
  if (arrayIndex === -1) {
    return {
      collectionPath: null,
      isCollection: false,
      selector: normalizedSelector,
      valuePath: stripRoot(normalizedSelector),
    };
  }

  const collectionSelector = normalizedSelector.slice(0, arrayIndex);
  const valueSelector = normalizedSelector.slice(arrayIndex + 2).replace(/^\./, "");

  return {
    collectionPath: stripRoot(collectionSelector),
    isCollection: true,
    selector: normalizedSelector,
    valuePath: valueSelector,
  };
}

function getFieldValue(row, selector) {
  const parsed = typeof selector === "string" ? parseFieldPath(selector) : selector;
  if (!parsed || parsed.valuePath === "") return row;
  return _.get(row, parsed.valuePath);
}

function resolveCollectionPath(selectors = [], rowPath) {
  if (rowPath) {
    const parsedRowPath = parseFieldPath(rowPath);
    return parsedRowPath.isCollection
      ? parsedRowPath.collectionPath
      : parsedRowPath.valuePath;
  }

  const paths = selectors
    .filter((selector) => typeof selector === "string" && selector.length > 0)
    .map((selector) => parseFieldPath(selector))
    .filter((parsed) => parsed.isCollection)
    .map((parsed) => parsed.collectionPath);
  const uniquePaths = [...new Set(paths)];

  if (uniquePaths.length > 1) {
    throw new FieldPathError(
      `Encodings reference different row collections: ${uniquePaths.join(", ")}`,
      selectors.join(", ")
    );
  }

  return uniquePaths.length === 1 ? uniquePaths[0] : null;
}

function selectRows(data, selectors = [], rowPath) {
  const collectionPath = resolveCollectionPath(selectors, rowPath);

  if (collectionPath !== null) {
    const selected = collectionPath === "" ? data : _.get(data, collectionPath);
    return Array.isArray(selected) ? selected : [];
  }

  if (Array.isArray(data)) return data;
  if (data === undefined || data === null) return [];
  return [data];
}

module.exports = {
  FieldPathError,
  getFieldValue,
  parseFieldPath,
  resolveCollectionPath,
  selectRows,
};
