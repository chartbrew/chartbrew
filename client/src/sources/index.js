import ApiConnectionForm from "./api/api-connection-form";
import MongoConnectionForm from "./mongodb/mongodb-connection-form";
import PostgresConnectionForm from "./postgres/postgres-connection-form";
import MysqlConnectionForm from "./mysql/mysql-connection-form";
import TimescaledbConnectionForm from "./timescaledb/timescaledb-connection-form";
import SupabasedbConnectionForm from "./supabasedb/supabasedb-connection-form";
import RdsPostgresConnectionForm from "./rdspostgres/rdspostgres-connection-form";
import RdsMysqlConnectionForm from "./rdsmysql/rdsmysql-connection-form";
import FirestoreConnectionForm from "./firestore/firestore-connection-form";
import RealtimeDbConnectionForm from "./realtimedb/realtimedb-connection-form";
import GaConnectionForm from "./googleAnalytics/googleAnalytics-connection-form";
import StrapiConnectionForm from "./strapi/strapi-connection-form";
import StripeConnectionForm from "./stripe/stripe-connection-form";
import StripeOfficialConnectionForm from "./stripeOfficial/stripeOfficial-connection-form";
import CustomerioConnectionForm from "./customerio/customerio-connection-form";
import ClickHouseConnectionForm from "./clickhouse/clickhouse-connection-form";
import ApiBuilder from "./api/api-builder";
import PostgresBuilder from "./postgres/postgres-builder";
import MysqlBuilder from "./mysql/mysql-builder";
import TimescaledbBuilder from "./timescaledb/timescaledb-builder";
import SupabasedbBuilder from "./supabasedb/supabasedb-builder";
import RdsPostgresBuilder from "./rdspostgres/rdspostgres-builder";
import RdsMysqlBuilder from "./rdsmysql/rdsmysql-builder";
import MongoQueryBuilder from "./mongodb/mongodb-builder";
import RealtimeDbBuilder from "./realtimedb/realtimedb-builder";
import FirestoreBuilder from "./firestore/firestore-builder";
import GaBuilder from "./googleAnalytics/googleAnalytics-builder";
import CustomerioBuilder from "./customerio/customerio-builder";
import ClickHouseBuilder from "./clickhouse/clickhouse-builder";
import StripeOfficialBuilder from "./stripeOfficial/stripeOfficial-builder";
import StripeOfficialTemplateSetup from "./stripeOfficial/stripeOfficial-template-setup";
import SOURCE_DEFINITIONS, {
  findSourceDefinitionForConnection,
  getSourceDefinition,
  getSourceDefinitionLogo,
  getSourceDefinitionSummaries,
} from "./definitions";
import { canCreateSourceConnections } from "./sourceAvailability";

const FRONTEND_BY_SOURCE_ID = {
  api: {
    ConnectionForm: ApiConnectionForm,
    DataRequestBuilder: ApiBuilder,
  },
  mongodb: {
    ConnectionForm: MongoConnectionForm,
    DataRequestBuilder: MongoQueryBuilder,
  },
  postgres: {
    ConnectionForm: PostgresConnectionForm,
    DataRequestBuilder: PostgresBuilder,
  },
  mysql: {
    ConnectionForm: MysqlConnectionForm,
    DataRequestBuilder: MysqlBuilder,
  },
  firestore: {
    ConnectionForm: FirestoreConnectionForm,
    DataRequestBuilder: FirestoreBuilder,
  },
  realtimedb: {
    ConnectionForm: RealtimeDbConnectionForm,
    DataRequestBuilder: RealtimeDbBuilder,
  },
  googleAnalytics: {
    ConnectionForm: GaConnectionForm,
    DataRequestBuilder: GaBuilder,
  },
  strapi: {
    ConnectionForm: StrapiConnectionForm,
    DataRequestBuilder: ApiBuilder,
  },
  stripe: {
    ConnectionForm: StripeConnectionForm,
    DataRequestBuilder: ApiBuilder,
  },
  stripeOfficial: {
    ConnectionForm: StripeOfficialConnectionForm,
    DataRequestBuilder: StripeOfficialBuilder,
    ChartTemplateSetup: StripeOfficialTemplateSetup,
  },
  customerio: {
    ConnectionForm: CustomerioConnectionForm,
    DataRequestBuilder: CustomerioBuilder,
  },
  timescaledb: {
    ConnectionForm: TimescaledbConnectionForm,
    DataRequestBuilder: TimescaledbBuilder,
  },
  supabasedb: {
    ConnectionForm: SupabasedbConnectionForm,
    DataRequestBuilder: SupabasedbBuilder,
  },
  rdsPostgres: {
    ConnectionForm: RdsPostgresConnectionForm,
    DataRequestBuilder: RdsPostgresBuilder,
  },
  rdsMysql: {
    ConnectionForm: RdsMysqlConnectionForm,
    DataRequestBuilder: RdsMysqlBuilder,
  },
  clickhouse: {
    ConnectionForm: ClickHouseConnectionForm,
    DataRequestBuilder: ClickHouseBuilder,
  },
};

const SOURCE_PLUGINS = SOURCE_DEFINITIONS.map((source) => ({
  ...source,
  frontend: FRONTEND_BY_SOURCE_ID[source.id] || {},
}));

export function getSourcePlugin(id) {
  const source = getSourceDefinition(id);
  return SOURCE_PLUGINS.find((item) => item.id === source.id);
}

export function getSourceForConnection(connection) {
  const source = findSourceForConnection(connection);

  if (!source) {
    const sourceId = connection?.subType || connection?.type;
    throw new Error(`Unsupported connection source: ${sourceId}`);
  }

  return source;
}

export function findSourceForConnection(connection) {
  const sourceDefinition = findSourceDefinitionForConnection(connection);
  if (!sourceDefinition) return null;

  return SOURCE_PLUGINS.find((item) => item.id === sourceDefinition.id) || null;
}

export function getSourceLogo(source, isDark) {
  return getSourceDefinitionLogo(source, isDark);
}

export function getSourcePickerItems() {
  return SOURCE_PLUGINS.filter(canCreateSourceConnections);
}

export function getSourceSummaries() {
  return getSourceDefinitionSummaries();
}

export default SOURCE_PLUGINS;
