const { normalizeSqlQuery } = require("../../../../sources/shared/sql/readOnlyQuery");

function normalizeAiQuery(source, query) {
  if (source.backend?.normalizeQuery) {
    return source.backend.normalizeQuery(query);
  }
  if (["postgres", "mysql"].includes(source.type)) {
    return normalizeSqlQuery(query);
  }
  return query;
}

module.exports = { normalizeAiQuery };
