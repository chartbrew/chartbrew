import apiSource from "./api/api.source";
import clickhouseSource from "./clickhouse/clickhouse.source";
import firestoreSource from "./firestore/firestore.source";
import googleAnalyticsSource from "./googleAnalytics/googleAnalytics.source";
import mongodbSource from "./mongodb/mongodb.source";
import mysqlSource from "./mysql/mysql.source";
import postgresSource from "./postgres/postgres.source";
import rdsPostgresSource from "./rdspostgres/rdspostgres.source";
import rdsMysqlSource from "./rdsmysql/rdsmysql.source";
import realtimeDbSource from "./realtimedb/realtimedb.source";
import supabasedbSource from "./supabasedb/supabasedb.source";
import timescaledbSource from "./timescaledb/timescaledb.source";
import stripeSource from "./stripe/stripe.source";
import stripeOfficialSource from "./stripeOfficial/stripeOfficial.source";
import strapiSource from "./strapi/strapi.source";
import customerioSource from "./customerio/customerio.source";
import { applySourceAvailability } from "./sourceAvailability";

const SOURCE_DEFINITIONS = [{
  ...apiSource,
}, {
  ...mongodbSource,
}, {
  ...postgresSource,
}, {
  ...mysqlSource,
}, {
  ...firestoreSource,
}, {
  ...realtimeDbSource,
}, {
  ...googleAnalyticsSource,
}, {
  ...strapiSource,
}, {
  ...stripeSource,
}, {
  ...stripeOfficialSource,
}, {
  ...customerioSource,
}, {
  ...timescaledbSource,
}, {
  ...supabasedbSource,
}, {
  ...rdsPostgresSource,
}, {
  ...rdsMysqlSource,
}, {
  ...clickhouseSource,
}].map(applySourceAvailability);

const sourceIds = new Set();
SOURCE_DEFINITIONS.forEach((source) => {
  if (sourceIds.has(source.id)) {
    throw new Error(`Duplicate source plugin id: ${source.id}`);
  }
  sourceIds.add(source.id);
});

export function getSourceDefinition(id) {
  const source = SOURCE_DEFINITIONS.find((item) => item.id === id);

  if (!source) {
    throw new Error(`Unsupported source plugin: ${id}`);
  }

  return source;
}

export function findSourceDefinitionForConnection(connection) {
  const sourceId = connection?.subType || connection?.type;
  return SOURCE_DEFINITIONS.find((item) => item.id === sourceId)
    || SOURCE_DEFINITIONS.find((item) => item.type === connection?.type && !item.subType)
    || null;
}

export function getSourceDefinitionLogo(source, isDark) {
  if (!source) return null;
  return isDark ? source.assets?.darkLogo : source.assets?.lightLogo;
}

export function getSourceDefinitionSummaries() {
  return SOURCE_DEFINITIONS.map((source) => ({
    id: source.id,
    type: source.type,
    subType: source.subType,
    name: source.name,
    category: source.category,
    availability: source.availability,
    capabilities: source.capabilities,
    dependsOn: source.dependsOn,
  }));
}

export default SOURCE_DEFINITIONS;
