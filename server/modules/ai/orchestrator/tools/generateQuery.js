const { getSourceByDialect, requireSourceById } = require("../sourceSupport");

async function getSourceInstructions(source) {
  if (source.backend?.ai?.getCapabilities) {
    const capabilities = await source.backend.ai.getCapabilities({});
    return capabilities?.instructions || source.backend?.ai?.instructions;
  }

  return source.backend?.ai?.instructions;
}

async function generateQuery(payload) {
  const {
    question, schema, preferred_dialect, source_id
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

    const source = source_id
      ? requireSourceById(source_id)
      : getSourceByDialect(preferred_dialect || schema?.source_id);

    if (!source?.backend?.ai?.generateQuery) {
      throw new Error(`No AI query generator is available for '${preferred_dialect || source_id || "unknown"}'`);
    }
    const sourceInstructions = await getSourceInstructions(source);
    const schemaForGeneration = Array.isArray(effectiveSchema)
      ? { entities: effectiveSchema, sourceInstructions }
      : {
        ...effectiveSchema,
        sourceInstructions: effectiveSchema.sourceInstructions || sourceInstructions,
      };

    const result = await source.backend.ai.generateQuery({
      schema: schemaForGeneration,
      question,
      conversationHistory: [],
    });

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
      dialect: source.type,
      source_id: source.id,
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
