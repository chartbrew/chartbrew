const db = require("../../../../models/models");
const ConnectionController = require("../../../../controllers/ConnectionController");

const connectionController = new ConnectionController();

async function runQuery(payload) {
  const {
    connection_id, dialect, query, row_limit = 1000, timeout_ms = 8000, team_id
  } = payload;

  if (!team_id) {
    throw new Error("team_id is required to run queries");
  }

  // Validate that the query is read-only (whole words only)
  const forbiddenKeywords = ["DROP", "DELETE", "UPDATE", "INSERT", "TRUNCATE", "ALTER", "CREATE"];
  const upperQuery = query.toUpperCase();
  const hasForbiddenKeyword = forbiddenKeywords.some((keyword) => {
    // Use word boundaries to avoid false positives
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    return regex.test(upperQuery);
  });

  if (hasForbiddenKeyword) {
    throw new Error("Only read-only queries (SELECT) are allowed");
  }

  try {
    const startTime = Date.now();

    // Add LIMIT clause if not present to respect row_limit
    let limitedQuery = query.trim();
    if (!upperQuery.includes("LIMIT") && (dialect === "postgres" || dialect === "mysql")) {
      limitedQuery = `${limitedQuery.replace(/;$/, "")} LIMIT ${row_limit}`;
    }

    // Create a temporary Dataset and DataRequest for proper database relationships
    const tempDataset = await db.Dataset.create({
      team_id,
      connection_id,
      legend: "AI Query Dataset",
      draft: true,
      query: limitedQuery,
    });

    const tempDataRequest = await db.DataRequest.create({
      dataset_id: tempDataset.id,
      connection_id,
      query: limitedQuery,
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
      if (dialect === "postgres" || dialect === "mysql") {
        result = await connectionController.runMysqlOrPostgres(
          connection_id,
          tempDataRequest,
          false, // don't use cache
          limitedQuery
        );
      } else if (dialect === "mongodb") {
        result = await connectionController.runMongo(
          connection_id,
          tempDataRequest,
          false,
          limitedQuery
        );
      } else {
        throw new Error(`Unsupported dialect: ${dialect}`);
      }

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
        rows: data.slice(0, row_limit),
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
      await db.DataRequestCache.destroy({
        where: { dr_id: tempDataRequest.id }
      });
    }
  } catch (error) {
    throw new Error(`Query execution failed: ${error.message}`);
  }
}

module.exports = runQuery;
