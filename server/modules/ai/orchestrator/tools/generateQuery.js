const { generateSqlQuery } = require("../../generateSqlQuery");

async function generateQuery(payload) {
  const {
    question, schema, preferred_dialect
  } = payload;
  // hints could be used for entity-level hints in the future

  if (!global.openaiClient) {
    return {
      status: "unsupported",
      message: "Query generation requires OpenAI to be configured",
    };
  }

  try {
    // For database connections, use SQL generation
    // Validate schema input (make optional for robustness)
    if (schema && typeof schema !== "object") {
      throw new Error("Schema must be a valid object if provided");
    }

    // If no schema provided, create a minimal one (AI should provide schema)
    const effectiveSchema = schema || {
      tables: ["User"],
      description: {
        User: {
          id: { type: "INT" },
          name: { type: "VARCHAR(255)" },
          email: { type: "VARCHAR(255)" },
          createdAt: { type: "DATETIME" }
        }
      }
    };

    // Use the existing SQL generation module
    const result = await generateSqlQuery(effectiveSchema, question, []);

    // Check if query generation succeeded
    if (!result || !result.query || result.query.trim() === "") {
      throw new Error("Query generation failed - no query returned");
    }

    // Basic validation: check for forbidden keywords (whole words only)
    const forbiddenKeywords = ["DROP", "DELETE", "UPDATE", "INSERT", "TRUNCATE", "ALTER", "CREATE"];
    const upperQuery = result.query.toUpperCase();
    const hasForbiddenKeyword = forbiddenKeywords.some((keyword) => {
      // Use word boundaries to avoid false positives
      const regex = new RegExp(`\\b${keyword}\\b`, "i");
      return regex.test(upperQuery);
    });

    if (hasForbiddenKeyword) {
      return {
        status: "unsupported",
        message: "Generated query contains forbidden operations (only SELECT queries are allowed)",
        query: result.query,
      };
    }

    return {
      status: "ok",
      dialect: preferred_dialect,
      query: result.query,
      rationale: {
        message: "Query generated successfully",
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: `Query generation failed: ${error.message}`,
    };
  }
}

module.exports = generateQuery;
