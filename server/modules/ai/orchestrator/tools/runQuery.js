const db = require("../../../../models/models");
const drCacheController = require("../../../../controllers/DataRequestCacheController");
const {
  requireSupportedSourceForConnection,
  sourceUsesSourceOwnedConfiguration,
} = require("../sourceSupport");
const { normalizeTeamId, requireConnectionForTeam } = require("./teamScope");

const DEFAULT_ROW_LIMIT = 1000;
const MAX_ROW_LIMIT = 10000;
const SQL_LIMIT_SOURCES = ["postgres", "mysql", "clickhouse"];

const DANGEROUS_SQL_PATTERNS = [
  /\bdrop\b/i,
  /\bdelete\b/i,
  /\bupdate\b/i,
  /\binsert\b/i,
  /\btruncate\b/i,
  /\balter\b/i,
  /\bcreate\b/i,
  /\binto\b/i,
  /\bpg_read_file\s*\(/i,
  /\bpg_read_binary_file\s*\(/i,
  /\bpg_ls_dir\s*\(/i,
  /\blo_export\s*\(/i,
  /\blo_import\s*\(/i,
  /\bcopy\b[\s\S]*\bto\s+program\b/i,
  /\binto\s+(out|dump)file\b/i,
  /\bload_file\s*\(/i,
  /\bload\s+data\b/i,
  /\bgrant\b/i,
  /\brevoke\b/i,
  /\bexec(ute)?\b/i,
  /\bcall\b/i,
  /\bfile\s*\(/i,
  /\burl\s*\(/i,
];

function getSafeRowLimit(rowLimit) {
  const parsedRowLimit = Number(rowLimit);

  if (!Number.isInteger(parsedRowLimit) || parsedRowLimit <= 0) {
    return DEFAULT_ROW_LIMIT;
  }

  return Math.min(parsedRowLimit, MAX_ROW_LIMIT);
}

function normalizeSqlQuery(query) {
  if (typeof query !== "string") {
    throw new Error("query must be a string");
  }

  let normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new Error("query is required");
  }

  normalizedQuery = normalizedQuery.replace(/;\s*$/, "").trim();

  const upperQuery = normalizedQuery.toUpperCase();

  if (!upperQuery.startsWith("SELECT") && !upperQuery.startsWith("WITH")) {
    throw new Error("Only SELECT/WITH queries are allowed");
  }

  if (normalizedQuery.includes(";")) {
    throw new Error("Multi-statement queries are not allowed");
  }

  if (/--|\/\*|\*\//.test(normalizedQuery)) {
    throw new Error("SQL comments are not allowed in AI queries");
  }

  if (DANGEROUS_SQL_PATTERNS.some((pattern) => pattern.test(normalizedQuery))) {
    throw new Error("Query contains blocked operations");
  }

  return normalizedQuery;
}

function hasLimitClause(query) {
  return /\blimit\b/i.test(query);
}

async function runQuery(payload) {
  const {
    connection_id, query, configuration = null, row_limit = DEFAULT_ROW_LIMIT, timeout_ms = 8000, team_id
  } = payload;
  const safeRowLimit = getSafeRowLimit(row_limit);

  if (!team_id) {
    throw new Error("team_id is required to run queries");
  }

  const normalizedTeamId = normalizeTeamId(team_id);
  const connection = await requireConnectionForTeam(connection_id, normalizedTeamId);

  try {
    const startTime = Date.now();
    const source = requireSupportedSourceForConnection(connection);
    const isConfigurationRequest = !query && configuration && typeof configuration === "object";

    if (!query && !isConfigurationRequest) {
      throw new Error("query or configuration is required");
    }

    if (sourceUsesSourceOwnedConfiguration(source)) {
      throw new Error(`${source.name} uses source-owned configuration tools. Use source_preview_configuration for previews and create_temporary_chart for charts instead of run_query.`);
    }

    let limitedQuery = query || null;
    if (limitedQuery) {
      if (SQL_LIMIT_SOURCES.includes(source.type)) {
        limitedQuery = normalizeSqlQuery(limitedQuery);
      }

      if (!hasLimitClause(limitedQuery) && SQL_LIMIT_SOURCES.includes(source.type)) {
        limitedQuery = `${limitedQuery} LIMIT ${safeRowLimit}`;
      }
    }

    // Create a temporary Dataset and DataRequest for proper database relationships
    const tempDataset = await db.Dataset.create({
      team_id: normalizedTeamId,
      connection_id,
      legend: "AI Query Dataset",
      draft: true,
      query: limitedQuery,
    });

    const tempDataRequest = await db.DataRequest.create({
      dataset_id: tempDataset.id,
      connection_id,
      query: limitedQuery,
      configuration,
      method: "GET",
      useGlobalHeaders: true,
    });

    // Set as main data request
    await db.Dataset.update(
      { main_dr_id: tempDataRequest.id },
      { where: { id: tempDataset.id } }
    );

    let result;
    try {
      result = await source.backend.runDataRequest({
        connection,
        dataRequest: tempDataRequest,
        getCache: false,
        processedQuery: limitedQuery,
      });

      const elapsedMs = Date.now() - startTime;

      // Check if query exceeded timeout (post-execution check)
      if (elapsedMs > timeout_ms) {
        throw new Error(`Query exceeded timeout of ${timeout_ms}ms`);
      }

      const data = result.responseData?.data || [];

      // Extract column names from first row
      const columns = data.length > 0
        ? Object.keys(data[0]).map((name) => ({ name, type: typeof data[0][name] }))
        : [];

      return {
        rows: data.slice(0, safeRowLimit),
        columns,
        rowCount: data.length,
        elapsedMs,
      };
    } finally {
      // Clean up the temporary Dataset and DataRequest
      await db.DataRequest.destroy({
        where: { id: tempDataRequest.id }
      });

      await db.Dataset.destroy({
        where: { id: tempDataset.id }
      });

      // Also clean up any cache entries
      await drCacheController.remove(tempDataRequest.id);
    }
  } catch (error) {
    throw new Error(`Query execution failed: ${error.message}`);
  }
}

module.exports = runQuery;
