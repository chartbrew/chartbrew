import {
  describe,
  expect,
  it,
} from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.resolve(serverRoot, "..");

function expectFile(relativePath) {
  expect(fs.existsSync(path.join(repoRoot, relativePath))).toBe(true);
}

function expectNoFiles(relativePath) {
  const directory = path.join(repoRoot, relativePath);
  if (!fs.existsSync(directory)) {
    return;
  }

  expect(fs.readdirSync(directory)).toHaveLength(0);
}

describe("source plugin structure", () => {
  it("keeps migrated server sources in source-owned plugin folders", () => {
    expectFile("server/sources/plugins/clickhouse/clickhouse.plugin.js");
    expectFile("server/sources/plugins/clickhouse/clickhouse.protocol.js");
    expectFile("server/sources/plugins/clickhouse/clickhouse.connection.js");
    expectFile("server/sources/plugins/clickhouse/clickhouse.client.js");
    expectFile("server/sources/plugins/firestore/firestore.plugin.js");
    expectFile("server/sources/plugins/firestore/firestore.protocol.js");
    expectFile("server/sources/plugins/firestore/firestore.connection.js");
    expectFile("server/sources/plugins/googleAnalytics/googleAnalytics.plugin.js");
    expectFile("server/sources/plugins/googleAnalytics/googleAnalytics.protocol.js");
    expectFile("server/sources/plugins/googleAnalytics/googleAnalytics.connection.js");
    expectFile("server/sources/plugins/realtimedb/realtimedb.plugin.js");
    expectFile("server/sources/plugins/realtimedb/realtimedb.protocol.js");
    expectFile("server/sources/plugins/realtimedb/realtimedb.connection.js");
    expectFile("server/sources/plugins/api/api.plugin.js");
    expectFile("server/sources/plugins/strapi/strapi.plugin.js");
    expectFile("server/sources/plugins/stripe/stripe.plugin.js");
    expectFile("server/sources/plugins/stripe/templates/core-revenue.json");
    expectFile("server/sources/plugins/mongodb/mongodb.plugin.js");
    expectFile("server/sources/plugins/mongodb/mongodb.protocol.js");
    expectFile("server/sources/plugins/postgres/postgres.plugin.js");
    expectFile("server/sources/plugins/postgres/postgres.protocol.js");
    expectFile("server/sources/plugins/timescaledb/timescaledb.plugin.js");
    expectFile("server/sources/plugins/timescaledb/timescaledb.protocol.js");
    expectFile("server/sources/plugins/supabasedb/supabasedb.plugin.js");
    expectFile("server/sources/plugins/supabasedb/supabasedb.protocol.js");
    expectFile("server/sources/plugins/rdspostgres/rdspostgres.plugin.js");
    expectFile("server/sources/plugins/rdspostgres/rdspostgres.protocol.js");
    expectFile("server/sources/plugins/mysql/mysql.plugin.js");
    expectFile("server/sources/plugins/mysql/mysql.protocol.js");
    expectFile("server/sources/plugins/rdsmysql/rdsmysql.plugin.js");
    expectFile("server/sources/plugins/rdsmysql/rdsmysql.protocol.js");
    expectFile("server/sources/plugins/customerio/customerio.plugin.js");
    expectFile("server/sources/plugins/customerio/customerio.protocol.js");
    expectFile("server/sources/plugins/customerio/customerio.connection.js");
  });

  it("keeps shared source backend code under server/sources/shared", () => {
    expectFile("server/sources/shared/connectorRuntime.js");
    expectFile("server/sources/shared/protocols/api.protocol.js");
    expectFile("server/sources/shared/sql/externalDbConnection.js");
    expectFile("server/sources/shared/sql/sql.protocol.js");
    expectFile("server/sources/shared/templates/chartTemplateLoader.js");

    expect(fs.existsSync(path.join(repoRoot, "server/sources/protocols"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, "server/modules/connectorRuntime.js"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, "server/chartTemplates"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, "server/modules/externalDbConnection.js"))).toBe(false);
    expectNoFiles("server/modules/clickhouse");
  });

  it("keeps migrated client sources and assets in source-owned folders", () => {
    expectFile("client/src/sources/api/api.source.js");
    expectFile("client/src/sources/api/api-connection-form.jsx");
    expectFile("client/src/sources/api/api-builder.jsx");
    expectFile("client/src/sources/api/api-pagination.jsx");
    expectFile("client/src/sources/api/assets/api.png");
    expectFile("client/src/sources/api/assets/api-dark.png");

    expectFile("client/src/sources/strapi/strapi.source.js");
    expectFile("client/src/sources/strapi/strapi-connection-form.jsx");
    expectFile("client/src/sources/strapi/assets/strapi-connection.webp");
    expectFile("client/src/sources/strapi/assets/Strapi-dark.png");

    expectFile("client/src/sources/stripe/stripe.source.js");
    expectFile("client/src/sources/stripe/stripe-connection-form.jsx");
    expectFile("client/src/sources/stripe/assets/stripe-connection.webp");
    expectFile("client/src/sources/stripe/assets/stripe-dark.png");

    expectFile("client/src/sources/postgres/postgres.source.js");
    expectFile("client/src/sources/postgres/postgres-connection-form.jsx");
    expectFile("client/src/sources/postgres/postgres-builder.jsx");
    expectFile("client/src/sources/postgres/assets/postgres.png");
    expectFile("client/src/sources/postgres/assets/postgres-dark.png");
    expectFile("client/src/sources/shared/sql/sql-builder.jsx");

    expectFile("client/src/sources/clickhouse/clickhouse.source.js");
    expectFile("client/src/sources/clickhouse/clickhouse-connection-form.jsx");
    expectFile("client/src/sources/clickhouse/clickhouse-builder.jsx");
    expectFile("client/src/sources/clickhouse/assets/clickhouse-light.svg");
    expectFile("client/src/sources/clickhouse/assets/clickhouse-dark.svg");

    expectFile("client/src/sources/firestore/firestore.source.js");
    expectFile("client/src/sources/firestore/firestore-connection-form.jsx");
    expectFile("client/src/sources/firestore/firestore-builder.jsx");
    expectFile("client/src/sources/firestore/assets/firestore-light.webp");
    expectFile("client/src/sources/firestore/assets/firestore-dark.webp");

    expectFile("client/src/sources/realtimedb/realtimedb.source.js");
    expectFile("client/src/sources/realtimedb/realtimedb-connection-form.jsx");
    expectFile("client/src/sources/realtimedb/realtimedb-builder.jsx");
    expectFile("client/src/sources/realtimedb/assets/rd-light.webp");
    expectFile("client/src/sources/realtimedb/assets/rd-dark.webp");
    expectFile("client/src/sources/realtimedb/assets/realtime-db-url.webp");

    expectFile("client/src/sources/googleAnalytics/googleAnalytics.source.js");
    expectFile("client/src/sources/googleAnalytics/googleAnalytics-connection-form.jsx");
    expectFile("client/src/sources/googleAnalytics/googleAnalytics-builder.jsx");
    expectFile("client/src/sources/googleAnalytics/googleAnalytics-template.jsx");
    expectFile("client/src/sources/googleAnalytics/assets/GoogleAnalytics.webp");
    expectFile("client/src/sources/googleAnalytics/assets/googleanalytics-dark.png");
    expectFile("client/src/sources/googleAnalytics/assets/ga-template.jpeg");

    expectFile("client/src/sources/mongodb/mongodb.source.js");
    expectFile("client/src/sources/mongodb/mongodb-connection-form.jsx");
    expectFile("client/src/sources/mongodb/mongodb-builder.jsx");
    expectFile("client/src/sources/mongodb/assets/mongodb-logo.png");
    expectFile("client/src/sources/mongodb/assets/mongodb-dark.png");

    expectFile("client/src/sources/timescaledb/timescaledb.source.js");
    expectFile("client/src/sources/timescaledb/timescaledb-connection-form.jsx");
    expectFile("client/src/sources/timescaledb/timescaledb-builder.jsx");
    expectFile("client/src/sources/timescaledb/assets/timescale-light.webp");
    expectFile("client/src/sources/timescaledb/assets/timescale-dark.webp");

    expectFile("client/src/sources/supabasedb/supabasedb.source.js");
    expectFile("client/src/sources/supabasedb/supabasedb-connection-form.jsx");
    expectFile("client/src/sources/supabasedb/supabasedb-builder.jsx");
    expectFile("client/src/sources/supabasedb/assets/supabase-connection.webp");
    expectFile("client/src/sources/supabasedb/assets/Supabase-dark.png");

    expectFile("client/src/sources/rdspostgres/rdspostgres.source.js");
    expectFile("client/src/sources/rdspostgres/rdspostgres-connection-form.jsx");
    expectFile("client/src/sources/rdspostgres/rdspostgres-builder.jsx");
    expectFile("client/src/sources/rdspostgres/assets/rds.png");
    expectFile("client/src/sources/rdspostgres/assets/rds-dark.png");

    expectFile("client/src/sources/mysql/mysql.source.js");
    expectFile("client/src/sources/mysql/mysql-connection-form.jsx");
    expectFile("client/src/sources/mysql/mysql-builder.jsx");
    expectFile("client/src/sources/mysql/assets/mysql.png");
    expectFile("client/src/sources/mysql/assets/mysql-dark.png");

    expectFile("client/src/sources/rdsmysql/rdsmysql.source.js");
    expectFile("client/src/sources/rdsmysql/rdsmysql-connection-form.jsx");
    expectFile("client/src/sources/rdsmysql/rdsmysql-builder.jsx");
    expectFile("client/src/sources/rdsmysql/assets/rds.png");
    expectFile("client/src/sources/rdsmysql/assets/rds-dark.png");

    expectFile("client/src/sources/customerio/customerio.source.js");
    expectFile("client/src/sources/customerio/customerio-connection-form.jsx");
    expectFile("client/src/sources/customerio/customerio-builder.jsx");
    expectFile("client/src/sources/customerio/assets/customerio-light.webp");
    expectFile("client/src/sources/customerio/assets/customerio-dark.webp");

    expectNoFiles("client/src/containers/Connections/Stripe");
    expectNoFiles("client/src/containers/Connections/Customerio");
    expectNoFiles("client/src/containers/Connections/ClickHouse");
    expectNoFiles("client/src/containers/Connections/Firestore");
    expectNoFiles("client/src/containers/Connections/RealtimeDb");
    expectNoFiles("client/src/containers/Connections/GoogleAnalytics");
    expectNoFiles("client/src/containers/Connections/Strapi");
    expect(fs.existsSync(path.join(repoRoot, "server/connections/RealtimeDatabase.js"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, "server/modules/firebaseConnector.js"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, "server/modules/googleConnector.js"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, "client/src/containers/Connections/components/MongoConnectionForm.jsx"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, "client/src/containers/Connections/components/PostgresConnectionForm.jsx"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, "client/src/containers/Connections/components/MysqlConnectionForm.jsx"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, "client/src/containers/Connections/components/ApiConnectionForm.jsx"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, "client/src/containers/AddChart/components/ApiBuilder.jsx"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, "client/src/containers/AddChart/components/ApiPagination.jsx"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, "client/src/containers/AddChart/components/MongoQueryBuilder.jsx"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, "client/src/containers/AddChart/components/SqlBuilder.jsx"))).toBe(false);
  });
});
