const acorn = require("acorn");

const BLOCKED_MEMBER_NAMES = new Set([
  "constructor",
  "__proto__",
  "prototype",
]);

const ALLOWED_HELPER_CALLS = new Set(["ObjectId", "Date"]);
const ALLOWED_HELPER_CONSTRUCTORS = new Set(["Date", "ObjectId"]);
const ALLOWED_UNARY_OPERATORS = new Set(["+", "-"]);

function invalid(message) {
  return { valid: false, message };
}

function validateDataExpression(node) {
  if (!node) {
    return invalid("Invalid argument expression");
  }

  switch (node.type) {
    case "Literal":
      return { valid: true };
    case "ArrayExpression": {
      for (const element of node.elements) {
        if (!element) {
          return invalid("Array holes are not allowed in query arguments");
        }
        if (element.type === "SpreadElement") {
          return invalid("Spread syntax is not allowed in query arguments");
        }
        const result = validateDataExpression(element);
        if (!result.valid) {
          return result;
        }
      }
      return { valid: true };
    }
    case "ObjectExpression": {
      for (const property of node.properties) {
        if (property.type !== "Property") {
          return invalid("Only plain object properties are allowed");
        }
        if (property.kind !== "init" || property.method || property.shorthand || property.computed) {
          return invalid("Only plain object literal syntax is allowed");
        }
        if (property.key.type !== "Identifier" && property.key.type !== "Literal") {
          return invalid("Invalid object property key");
        }

        const result = validateDataExpression(property.value);
        if (!result.valid) {
          return result;
        }
      }
      return { valid: true };
    }
    case "CallExpression": {
      if (node.callee.type !== "Identifier" || !ALLOWED_HELPER_CALLS.has(node.callee.name)) {
        return invalid("Only ObjectId() and Date() helper calls are allowed in arguments");
      }
      for (const argument of node.arguments) {
        if (argument.type === "SpreadElement") {
          return invalid("Spread syntax is not allowed in query arguments");
        }
        const result = validateDataExpression(argument);
        if (!result.valid) {
          return result;
        }
      }
      return { valid: true };
    }
    case "NewExpression": {
      if (node.callee.type !== "Identifier" || !ALLOWED_HELPER_CONSTRUCTORS.has(node.callee.name)) {
        return invalid("Only new Date() and new ObjectId() are allowed in arguments");
      }
      for (const argument of node.arguments) {
        if (argument.type === "SpreadElement") {
          return invalid("Spread syntax is not allowed in query arguments");
        }
        const result = validateDataExpression(argument);
        if (!result.valid) {
          return result;
        }
      }
      return { valid: true };
    }
    case "UnaryExpression": {
      if (!ALLOWED_UNARY_OPERATORS.has(node.operator)) {
        return invalid("Only unary + and - operators are allowed in query arguments");
      }
      return validateDataExpression(node.argument);
    }
    default:
      return invalid(`Unsupported expression in query arguments: ${node.type}`);
  }
}

function validateMongoCallChain(node) {
  if (!node || node.type !== "CallExpression") {
    return invalid("Query must be a MongoDB call chain");
  }

  for (const argument of node.arguments) {
    if (argument.type === "SpreadElement") {
      return invalid("Spread syntax is not allowed in query arguments");
    }
    const argumentValidation = validateDataExpression(argument);
    if (!argumentValidation.valid) {
      return argumentValidation;
    }
  }

  if (node.callee.type === "Identifier") {
    if (node.callee.name === "collection" || node.callee.name === "db") {
      return { valid: true };
    }
    return invalid(`Unexpected root call: "${node.callee.name}"`);
  }

  if (node.callee.type !== "MemberExpression") {
    return invalid("Query callee must be a member access");
  }

  if (node.callee.computed) {
    return invalid("Computed member access is not allowed in query calls");
  }

  if (node.callee.property.type !== "Identifier") {
    return invalid("Invalid query method access");
  }

  if (BLOCKED_MEMBER_NAMES.has(node.callee.property.name)) {
    return invalid(`Blocked member access: "${node.callee.property.name}"`);
  }

  if (node.callee.object.type === "Identifier") {
    if (node.callee.object.name === "db" && node.callee.property.name === "collection") {
      return { valid: true };
    }
    return invalid("Query must start with collection(), db(), or db.collection()");
  }

  return validateMongoCallChain(node.callee.object);
}

/**
 * @param {string} query - the formatted MongoDB query (after stripping "connection." prefix)
 * @returns {{ valid: boolean, message?: string }}
 */
function validateMongoQuery(query) {
  if (!query || typeof query !== "string") {
    return invalid("Query must be a non-empty string");
  }

  if (!acorn) {
    return invalid("Mongo query parser is unavailable");
  }

  const trimmed = query.trim();
  if (!trimmed) {
    return invalid("Query cannot be empty");
  }

  let parsedQuery;
  try {
    parsedQuery = acorn.parse(trimmed, { ecmaVersion: "latest", sourceType: "script" });
  } catch (error) {
    return invalid(`Invalid JavaScript expression: ${error.message}`);
  }

  if (parsedQuery.body.length !== 1 || parsedQuery.body[0].type !== "ExpressionStatement") {
    return invalid("Query must contain exactly one expression");
  }

  return validateMongoCallChain(parsedQuery.body[0].expression);
}

module.exports = validateMongoQuery;
