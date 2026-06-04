const { generateSqlQuery } = require("../../../modules/ai/generateSqlQuery");
const sqlProtocol = require("../../shared/sql/sql.protocol");

function testMysql(connection) {
  return sqlProtocol.testConnection({ connection });
}

function testConnection({ connection }) {
  return testMysql(connection);
}

function testUnsavedConnection({ connection, extras }) {
  return sqlProtocol.testUnsavedConnection({ connection, extras });
}

function prepareConnectionData({ connection }) {
  return sqlProtocol.prepareConnectionData({ connection });
}

function getSchema({ connection }) {
  return sqlProtocol.getSchema({ connection });
}

function runDataRequest(options) {
  return sqlProtocol.runDataRequest({
    ...options,
    connectionType: "mysql",
  });
}

function runChartQuery(options) {
  return sqlProtocol.runChartQuery(options);
}

function applyVariables(options) {
  return sqlProtocol.applyVariables({
    ...options,
    escapeBackslash: true,
  });
}

function generateQuery({
  schema,
  question,
  conversationHistory,
  currentQuery,
}) {
  return generateSqlQuery(schema, question, conversationHistory, currentQuery);
}

module.exports = {
  applyVariables,
  closeSqlConnection: sqlProtocol.closeSqlConnection,
  generateQuery,
  getSchema,
  getSchemaFromDbConnection: sqlProtocol.getSchemaFromDbConnection,
  prepareConnectionData,
  runChartQuery,
  runDataRequest,
  testConnection,
  testMysql,
  testUnsavedConnection,
};
