const db = require("../models");

module.exports.up = async () => {
  // mysql
  await db.Connection.update({ subType: "mysql" }, { where: { type: "mysql" } });
  // postgres
  await db.Connection.update({ subType: "postgres" }, { where: { type: "postgres" } });
  // api
  await db.Connection.update({ subType: "api" }, { where: { type: "api" } });
  // mongodb
  await db.Connection.update({ subType: "mongodb" }, { where: { type: "mongodb" } });
  // timescaledb
  await db.Connection.update({ subType: "timescaledb", type: "postgres" }, { where: { type: "timescaledb" } });
  // customerio
  await db.Connection.update({ subType: "customerio" }, { where: { type: "customerio" } });
  // realtimedb
  await db.Connection.update({ subType: "realtimedb" }, { where: { type: "realtimedb" } });
  // firestore
  await db.Connection.update({ subType: "firestore" }, { where: { type: "firestore" } });
  // googleAnalytics
  await db.Connection.update({ subType: "googleAnalytics" }, { where: { type: "googleAnalytics" } });
};

module.exports.down = async () => {
  await db.Connection.update({ subType: null, type: "timescaledb" }, { where: { subType: "timescaledb" } });
};
