const Sequelize = require("sequelize");

const db = require("../models");

module.exports = {
  up: (queryInterface) => {
    return db.ChartCache.destroy({ truncate: true })
      .then(() => {
        return queryInterface.addColumn("ChartCache", "chart_id", {
          type: Sequelize.INTEGER,
          allowNull: false,
          reference: {
            model: "Chart",
            key: "id",
            onDelete: "cascade",
          },
        });
      });
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn("ChartCache", "chart_id");
  },
};
