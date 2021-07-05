const Sequelize = require("sequelize");

const migrateFields = require("../scripts/migrateFieldsToDataRequest");

module.exports = {
  up: (queryInterface) => {
    return queryInterface.renameTable("ApiRequest", "DataRequest")
      .then(() => {
        return Promise.all([
          queryInterface.sequelize.query(`
            ALTER TABLE DataRequest MODIFY chart_id INT NULL
          `),
          queryInterface.addColumn("DataRequest", "dataset_id", {
            type: Sequelize.INTEGER,
            allowNull: false,
            reference: {
              model: "Dataset",
              key: "id",
              onDelete: "cascade",
            },
          }),
          queryInterface.addColumn("DataRequest", "query", {
            type: Sequelize.TEXT,
          }),
          queryInterface.addColumn("DataRequest", "pagination", {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
          }),
          queryInterface.addColumn("DataRequest", "items", {
            type: Sequelize.STRING,
            defaultValue: "items",
          }),
          queryInterface.addColumn("DataRequest", "itemsLimit", {
            type: Sequelize.INTEGER,
            defaultValue: 100,
          }),
          queryInterface.addColumn("DataRequest", "offset", {
            type: Sequelize.STRING,
            defaultValue: "offset",
          }),
        ]);
      })
      .then(() => {
        return migrateFields.up();
      })
      .then(() => {
        return Promise.all([
          queryInterface.removeColumn("Chart", "query"),
          queryInterface.removeColumn("Chart", "pagination"),
          queryInterface.removeColumn("Chart", "items"),
          queryInterface.removeColumn("Chart", "itemsLimit"),
          queryInterface.removeColumn("Chart", "offset"),
          queryInterface.removeColumn("DataRequest", "chart_id"),
        ]);
      })
      .catch(() => Promise.resolve("done"));
  },

  down: (queryInterface) => {
    return Promise.all([
      queryInterface.addColumn("Chart", "query", {
        type: Sequelize.TEXT,
      }),
      queryInterface.addColumn("Chart", "pagination", {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      }),
      queryInterface.addColumn("Chart", "items", {
        type: Sequelize.STRING,
        defaultValue: "items",
      }),
      queryInterface.addColumn("Chart", "itemsLimit", {
        type: Sequelize.INTEGER,
        defaultValue: 100,
      }),
      queryInterface.addColumn("Chart", "offset", {
        type: Sequelize.STRING,
        defaultValue: "offset",
      }),
      queryInterface.addColumn("DataRequest", "chart_id", {
        type: Sequelize.INTEGER,
        allowNull: false,
        reference: {
          model: "Chart",
          key: "id",
          onDelete: "cascade",
        },
      })
    ])
      .then(() => {
        return migrateFields.down();
      })
      .then(() => {
        return Promise.all([
          queryInterface.removeColumn("DataRequest", "query"),
          queryInterface.removeColumn("DataRequest", "pagination"),
          queryInterface.removeColumn("DataRequest", "items"),
          queryInterface.removeColumn("DataRequest", "itemsLimit"),
          queryInterface.removeColumn("DataRequest", "offset"),
          queryInterface.removeColumn("DataRequest", "dataset_id"),
        ]);
      })
      .then(() => {
        return queryInterface.renameTable("DataRequest", "ApiRequest");
      })
      .catch(() => Promise.resolve("done"));
  }
};
