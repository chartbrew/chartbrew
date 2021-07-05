const Sequelize = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addColumn("Dataset", "conditions", {
          type: Sequelize.TEXT,
          set(val) {
            return this.setDataValue("conditions", JSON.stringify(val));
          },
          get() {
            try {
              return JSON.parse(this.getDataValue("conditions"));
            } catch (e) {
              return this.getDataValue("conditions");
            }
          }
        }, { transaction: t }),
        queryInterface.removeColumn("Dataset", "xAxisType", { transaction: t }),
        queryInterface.removeColumn("Dataset", "yAxisType", { transaction: t }),
      ])
        .catch(() => Promise.resolve("done"));
    });
  },

  down: async (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.removeColumn("Dataset", "conditions", { transaction: t }),
        queryInterface.addColumn("Dataset", "xAxisType", {
          type: Sequelize.STRING,
        }, { transaction: t }),
        queryInterface.addColumn("Dataset", "yAxisType", {
          type: Sequelize.STRING,
        }, { transaction: t }),
      ])
        .catch(() => Promise.resolve("done"));
    });
  }
};
