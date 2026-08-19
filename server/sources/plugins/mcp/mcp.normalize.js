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

function coerceCell(value) {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "") return "";
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function splitDelimitedLine(line, delimiter) {
  if (delimiter === "|") {
    return line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
  }
  return line.split(delimiter).map((cell) => cell.trim());
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => cell === "" || /^:?-{2,}:?$/.test(cell));
}

function detectDelimiter(lines) {
  const sample = lines.slice(0, 8);
  const pipeHits = sample.filter((line) => line.includes("|")).length;
  if (pipeHits >= Math.min(sample.length, 2)) return "|";
  const tabHits = sample.filter((line) => line.includes("\t")).length;
  if (tabHits >= Math.min(sample.length, 2)) return "\t";
  const commaCounts = sample.map((line) => (line.match(/,/g) || []).length);
  if (commaCounts[0] >= 1 && commaCounts.every((count) => count === commaCounts[0])) return ",";
  return null;
}

function isHeaderName(line) {
  const text = String(line || "").trim();
  if (!text || text.length > 48) return false;
  if (/[\n\r|:;!?()[\]{}'"]/.test(text)) return false;
  if (!/^[A-Za-z_]/.test(text)) return false;
  return /^[A-Za-z_][A-Za-z0-9_ $/%.-]{0,47}$/.test(text) && (text.match(/\s/g) || []).length <= 3;
}

function isScalarCell(line) {
  const text = String(line || "").trim();
  if (!text || text.length > 120) return false;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(text)) return true;
  if (/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?/.test(text)) return true;
  if (/^(true|false|null)$/i.test(text)) return true;
  if ((text.match(/\s/g) || []).length > 4) return false;
  return !/[.!?]$/.test(text);
}

function isTypedOrIdentifierValue(value) {
  if (typeof coerceCell(value) === "number") return true;
  if (/^(true|false|null)$/i.test(value)) return true;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return true;
  return /[/_-]/.test(value) || /\d/.test(value);
}

function parseNewlineColumn(lines) {
  if (lines.length < 2 || !isHeaderName(lines[0])) return null;
  const values = lines.slice(1);
  if (!values.every(isScalarCell) || !values.some(isTypedOrIdentifierValue)) return null;
  const header = lines[0];
  return values.map((value) => ({ [header]: coerceCell(value) }));
}

function rowsFromCells(rows) {
  if (!rows.length) return null;
  const headers = rows[0].map((name, index) => name || `column_${index}`);
  if (!headers.length) return null;
  if (rows.length === 1) {
    const isStandaloneHeader = headers.length > 1
      && new Set(headers).size === headers.length
      && headers.every((name) => isHeaderName(name) && !/\s/.test(name));
    return isStandaloneHeader ? [] : null;
  }
  const aligned = rows.slice(1).filter((cells) => cells.length === headers.length);
  if (!aligned.length) return null;
  return aligned.map((cells) => headers.reduce((row, name, index) => {
    row[name] = coerceCell(cells[index]);
    return row;
  }, {}));
}

function parseTabularText(text) {
  if (typeof text !== "string") return null;
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return null;
  const delimiter = detectDelimiter(lines);
  if (!delimiter) return parseNewlineColumn(lines);

  const rows = lines
    .map((line) => splitDelimitedLine(line, delimiter))
    .filter((cells) => cells.length > 0 && !isSeparatorRow(cells));
  return rowsFromCells(rows);
}

function unwrapContentTable(value) {
  if (typeof value === "string") return parseTabularText(value);
  if (Array.isArray(value)
    && value.length === 1
    && value[0]
    && typeof value[0] === "object"
    && typeof value[0].content === "string"
    && Object.keys(value[0]).length === 1) {
    return parseTabularText(value[0].content);
  }
  if (value && typeof value === "object" && typeof value.content === "string" && Object.keys(value).length === 1) {
    return parseTabularText(value.content);
  }
  return null;
}

function getBlockValue(block) {
  if (!block || typeof block !== "object") return null;
  if (block.type === "text") return parseJson(block.text) ?? unwrapContentTable(block.text) ?? block.text;
  if (block.type === "resource" && typeof block.resource?.text === "string") {
    if (String(block.resource.mimeType || "").toLowerCase().includes("html")) {
      throw createMcpError("MCP_UNSUPPORTED_RESULT", "HTML tool results cannot be used as dataset data.");
    }
    return parseJson(block.resource.text) ?? unwrapContentTable(block.resource.text) ?? block.resource.text;
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
    const table = unwrapContentTable(values[0]);
    if (table) return table;
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

function getColumnNames(value) {
  if (Array.isArray(value?.columns)) {
    return value.columns.map((column, index) => {
      if (typeof column === "string" && column.trim()) return column.trim();
      if (column && typeof column === "object") {
        return String(column.name || column.key || column.field || `column_${index}`);
      }
      return `column_${index}`;
    });
  }
  if (Array.isArray(value?.meta)) {
    return value.meta.map((column, index) => String(column?.name || `column_${index}`));
  }
  return [];
}

function getTabularCells(value) {
  if (!getColumnNames(value).length) return null;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.data)) return value.data;
  return null;
}

function getTupleCells(value) {
  const candidates = [value?.results, value?.rows, value?.data];
  return candidates.find((cells) => (
    Array.isArray(cells)
    && cells.length > 0
    && cells.every((row) => row == null || Array.isArray(row))
  )) || null;
}

function rowFromCells(row, columns) {
  if (Array.isArray(row)) {
    return columns.reduce((result, name, index) => {
      result[name] = row[index];
      return result;
    }, {});
  }
  if (row && typeof row === "object") return row;
  return { value: row };
}

function tabularize(value) {
  if (Array.isArray(value)) {
    if (
      value.length > 0
      && value.every((row) => row == null || Array.isArray(row))
    ) {
      const width = value.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
      const columns = Array.from({ length: width }, (_, index) => `column_${index}`);
      return value.map((row) => rowFromCells(row || [], columns));
    }
    return null;
  }
  const columns = getColumnNames(value);
  const cells = getTabularCells(value);
  if (columns.length && Array.isArray(cells)) {
    return cells.map((row) => rowFromCells(row, columns));
  }
  const tuples = getTupleCells(value);
  if (tuples) return tabularize(tuples);
  return null;
}

function selectAutomaticOutput(value) {
  const textTable = unwrapContentTable(value);
  if (textTable) return textTable;
  const table = tabularize(value);
  if (table) return table;
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
