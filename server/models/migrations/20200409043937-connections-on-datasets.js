const Sequelize = require("sequelize");

const migrateConnections = require("../scripts/migrateConnectionsOnDatasets");

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addColumn("Dataset", "connection_id", {
          type: Sequelize.INTEGER,
          allowNull: true,
          reference: {
            model: "Connection",
            key: "id",
            onDelete: "cascade",
          },
        }, { transaction: t }),
      ])
        .then(() => {
          return migrateConnections.up();
        })
        .then(() => {
          return queryInterface.removeColumn("Chart", "connection_id", { transaction: t });
        })
        .catch(() => Promise.resolve("done"));
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return queryInterface.addColumn("Chart", "connection_id", {
        connection_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: null,
          reference: {
            model: "Connection",
            key: "id",
            onDelete: "cascade",
          },
        },
      })
        .then(() => {
          return migrateConnections.down();
        })
        .then(() => {
          return Promise.all([
            queryInterface.removeColumn("Dataset", "connection_id", { transaction: t }),
          ]);
        });
    });
  }
};
