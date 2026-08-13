const { createMcpError } = require("./mcp.policy");
const { MCP_LIMITS } = require("./mcp.constants");

const FORBIDDEN_PATH_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function parseJson(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !["{", "[", '"', "-", "t", "f", "n"].includes(trimmed[0])
    && !/^\d/.test(trimmed)) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return null;
  }
}

function getBlockValue(block) {
  if (!block || typeof block !== "object") return null;
  if (block.type === "text") return parseJson(block.text) ?? block.text;
  if (block.type === "resource" && typeof block.resource?.text === "string") {
    if (String(block.resource.mimeType || "").toLowerCase().includes("html")) {
      throw createMcpError("MCP_UNSUPPORTED_RESULT", "HTML tool results cannot be used as dataset data.");
    }
    return parseJson(block.resource.text) ?? block.resource.text;
  }
  if (["audio", "image", "resource_link"].includes(block.type)) {
    throw createMcpError(
      "MCP_UNSUPPORTED_RESULT",
      "Media and linked resources cannot be used as dataset data."
    );
  }
  return null;
}

function normalizeToolResult(result) {
  if (result?.task || ["task", "input_required"].includes(result?.resultType)) {
    throw createMcpError(
      "MCP_INTERACTIVE_RESULT",
      "This MCP tool needs an interactive or long-running workflow that datasets do not support."
    );
  }
  const content = Array.isArray(result?.content) ? result.content : [];
  if (result?.isError) {
    const message = content
      .filter((block) => block?.type === "text")
      .map((block) => block.text)
      .join("\n")
      .slice(0, 2000);
    throw createMcpError("MCP_TOOL_ERROR", message || "The MCP tool returned an error.");
  }
  if (result?.structuredContent !== undefined) return result.structuredContent;

  const containsHtml = content.some((block) => {
    return block?.type === "text" && /^\s*(?:<!doctype\s+html|<html[\s>])/i.test(block.text || "");
  });
  if (containsHtml) {
    throw createMcpError("MCP_UNSUPPORTED_RESULT", "HTML tool results cannot be used as dataset data.");
  }

  const values = content.map(getBlockValue).filter((value) => value !== null);
  if (values.length === 0) return [];
  if (values.length === 1) {
    return typeof values[0] === "string" ? [{ content: values[0] }] : values[0];
  }
  return values.map((value) => (typeof value === "string" ? { content: value } : value));
}

function normalizePath(path) {
  if (Array.isArray(path)) return path.map(String);
  if (typeof path === "string") {
    return path.split(".").map((part) => part.trim()).filter(Boolean);
  }
  return [];
}

function selectPath(value, path) {
  return normalizePath(path).reduce((current, key) => {
    if (FORBIDDEN_PATH_KEYS.has(key) || current === null || current === undefined) {
      throw createMcpError("MCP_OUTPUT_PATH_NOT_FOUND", "The selected output path was not found.");
    }
    if (Array.isArray(current) && /^\d+$/.test(key)) return current[Number(key)];
    if (typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, key)) {
      throw createMcpError("MCP_OUTPUT_PATH_NOT_FOUND", "The selected output path was not found.");
    }
    return current[key];
  }, value);
}

function selectAutomaticOutput(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [{ value }];

  const commonKeys = ["data", "items", "results", "rows", "values", "records"];
  const commonArray = commonKeys.find((key) => Array.isArray(value[key]));
  if (commonArray) return value[commonArray];

  const arrayEntries = Object.entries(value).filter(([, child]) => Array.isArray(child));
  if (arrayEntries.length === 1) return arrayEntries[0][1];
  return [value];
}

function selectToolOutput(value, output = {}) {
  let rows;
  if (output.mode === "path" || normalizePath(output.path).length > 0) {
    rows = selectAutomaticOutput(selectPath(value, output.path));
  } else {
    rows = selectAutomaticOutput(value);
  }
  if (rows.length > MCP_LIMITS.maxResultRows) {
    throw createMcpError("MCP_TOO_MANY_ROWS", "The MCP tool returned too many rows.");
  }
  return rows;
}

module.exports = {
  normalizeToolResult,
  selectToolOutput,
};
