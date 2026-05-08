const { requireSupportedSourceForConnection } = require("../sourceSupport");
const { requireConnectionForTeam } = require("./teamScope");

async function getSchema(payload) {
  const { connection_id, include_samples = true, team_id } = payload;
  // sample_rows_per_entity could be used when extracting samples in the future

  const connection = await requireConnectionForTeam(connection_id, team_id);

  const source = requireSupportedSourceForConnection(connection);
  let schema;
  if (source.capabilities?.ai?.hasTools && source.backend.ai?.getSchema) {
    schema = await source.backend.ai.getSchema({ connection });
  } else {
    schema = connection.schema
      || await source.backend.ai?.getSchema?.({ connection })
      || await source.backend.getSchema?.({ connection });
  }
  const entities = Array.isArray(schema) ? schema : schema?.entities || schema || [];

  return {
    dialect: connection.type,
    source_id: source.id,
    source_name: source.name,
    connection_id: connection.id,
    name: connection.name,
    entities,
    samples: include_samples ? {} : undefined,
  };
}

module.exports = getSchema;
