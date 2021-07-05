const Sequelize = require("sequelize");

module.exports = {
  up: (queryInterface) => {
    return queryInterface.createTable("Dataset", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      chart_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        reference: {
          model: "Chart",
          key: "id",
          onDelete: "cascade",
        },
      },
      query: {
        type: Sequelize.TEXT,
      },
      xAxis: {
        type: Sequelize.STRING,
      },
      xAxisType: {
        type: Sequelize.STRING,
      },
      xAxisOperation: {
        type: Sequelize.STRING,
      },
      yAxis: {
        type: Sequelize.STRING,
      },
      yAxisType: {
        type: Sequelize.STRING,
      },
      yAxisOperation: {
        type: Sequelize.STRING,
      },
      datasetColor: {
        type: Sequelize.TEXT,
      },
      fillColor: {
        type: Sequelize.TEXT,
        set(val) {
          try {
            return this.setDataValue("fillColor", JSON.stringify(val));
          } catch (e) {
            return this.setDataValue("fillColor", val);
          }
        },
        get() {
          try {
            return JSON.parse(this.getDataValue("fillColor"));
          } catch (e) {
            return this.getDataValue("fillColor");
          }
        }
      },
      dateFormat: {
        type: Sequelize.STRING,
      },
      legend: {
        type: Sequelize.STRING,
      },
      pointRadius: {
        type: Sequelize.INTEGER,
      },
      patterns: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "[]",
        set(val) {
          return this.setDataValue("patterns", JSON.stringify(val));
        },
        get() {
          try {
            return JSON.parse(this.getDataValue("patterns"));
          } catch (e) {
            return this.getDataValue("patterns");
          }
        }
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
    });
  },
  down: (queryInterface) => {
    return queryInterface.dropTable("Dataset");
  }
};
