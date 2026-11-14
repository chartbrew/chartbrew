const { requireSupportedSourceForConnection } = require("../sourceSupport");
const { requireConnectionForTeam } = require("./teamScope");
const { normalizeAiQuery } = require("./normalizeAiQuery");

async function validateQuery({ connection_id, query, team_id }) {
  const connection = await requireConnectionForTeam(connection_id, team_id);
  const source = requireSupportedSourceForConnection(connection);
  if (!source.backend?.normalizeQuery && !["postgres", "mysql"].includes(source.type)) {
    return { valid: false, message: "Query validation is not available for this source." };
  }

  try {
    normalizeAiQuery(source, query);
    return { valid: true, message: "Query passed the safety checks. It has not been executed." };
  } catch (error) {
    return { valid: false, message: error.message };
  }
}

module.exports = validateQuery;
