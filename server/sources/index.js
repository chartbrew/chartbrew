const validateSourcePlugin = require("./validateSourcePlugin");
const { applySourceAvailability } = require("./sourceAvailability");
const api = require("./plugins/api/api.plugin");
const clickhouse = require("./plugins/clickhouse/clickhouse.plugin");
const customerio = require("./plugins/customerio/customerio.plugin");
const firestore = require("./plugins/firestore/firestore.plugin");
const googleAnalytics = require("./plugins/googleAnalytics/googleAnalytics.plugin");
const mongodb = require("./plugins/mongodb/mongodb.plugin");
const mysql = require("./plugins/mysql/mysql.plugin");
const postgres = require("./plugins/postgres/postgres.plugin");
const rdspostgres = require("./plugins/rdspostgres/rdspostgres.plugin");
const rdsmysql = require("./plugins/rdsmysql/rdsmysql.plugin");
const realtimedb = require("./plugins/realtimedb/realtimedb.plugin");
const stripe = require("./plugins/stripe/stripe.plugin");
const stripeOfficial = require("./plugins/stripeOfficial/stripeOfficial.plugin");
const strapi = require("./plugins/strapi/strapi.plugin");
const supabasedb = require("./plugins/supabasedb/supabasedb.plugin");
const timescaledb = require("./plugins/timescaledb/timescaledb.plugin");

const sources = [
  api,
  clickhouse,
  customerio,
  firestore,
  googleAnalytics,
  mongodb,
  mysql,
  postgres,
  rdspostgres,
  rdsmysql,
  realtimedb,
  stripe,
  stripeOfficial,
  strapi,
  supabasedb,
  timescaledb,
].map(validateSourcePlugin).map(applySourceAvailability);

const sourceIds = new Set();
sources.forEach((source) => {
  if (sourceIds.has(source.id)) {
    throw new Error(`Duplicate source plugin id: ${source.id}`);
  }
  sourceIds.add(source.id);
});

sources.forEach((source) => {
  (source.dependsOn || []).forEach((dependencyId) => {
    if (!sourceIds.has(dependencyId)) {
      throw new Error(`Source plugin ${source.id} depends on unknown source plugin ${dependencyId}`);
    }
  });
});

function getSourceById(id) {
  const source = sources.find((item) => item.id === id);

  if (!source) {
    throw new Error(`Unsupported source id: ${id}`);
  }

  return source;
}

function getSourceForConnection(connection) {
  const sourceId = connection?.subType || connection?.type;
  const source = sources.find((item) => item.id === sourceId)
    || sources.find((item) => item.type === connection?.type && !item.subType);

  if (!source) {
    throw new Error(`Unsupported connection source: ${sourceId}`);
  }

  return source;
}

function findSourceForConnection(connection) {
  const sourceId = connection?.subType || connection?.type;
  return sources.find((item) => item.id === sourceId)
    || sources.find((item) => item.type === connection?.type && !item.subType)
    || null;
}

function getSourceSummaries() {
  return sources.map((source) => ({
    id: source.id,
    type: source.type,
    subType: source.subType,
    name: source.name,
    category: source.category,
    description: source.description,
    availability: source.availability,
    capabilities: source.capabilities,
    dependsOn: source.dependsOn,
  }));
}

function getSources() {
  return [...sources];
}

module.exports = {
  findSourceForConnection,
  getSourceById,
  getSourceForConnection,
  getSources,
  getSourceSummaries,
};
