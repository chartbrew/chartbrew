const Sequelize = require("sequelize");
const moment = require("moment");

module.exports = {
  up: (queryInterface) => {
    return queryInterface.createTable("Chart", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        reference: {
          model: "Project",
          key: "id",
          onDelete: "cascade",
        },
      },
      connection_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        reference: {
          model: "Connection",
          key: "id",
          onDelete: "cascade",
        },
      },
      name: {
        type: Sequelize.STRING,
      },
      type: {
        type: Sequelize.STRING,
      },
      subType: {
        type: Sequelize.STRING,
      },
      public: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      query: {
        type: Sequelize.TEXT,
      },
      chartData: {
        type: Sequelize.TEXT("long"),
        set(val) {
          return this.setDataValue("chartData", JSON.stringify(val));
        },
        get() {
          try {
            return JSON.parse(this.getDataValue("chartData"));
          } catch (e) {
            return this.getDataValue("chartData");
          }
        }
      },
      chartDataUpdated: {
        type: Sequelize.DATE,
      },
      chartSize: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 2,
      },
      dashboardOrder: {
        type: Sequelize.INTEGER,
      },
      displayLegend: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      pointRadius: {
        type: Sequelize.INTEGER,
      },
      startDate: {
        type: Sequelize.DATE,
      },
      endDate: {
        type: Sequelize.DATE,
      },
      includeZeros: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      currentEndDate: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      timeInterval: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "day",
      },
      autoUpdate: {
        type: Sequelize.INTEGER, // represented in seconds
      },
      lastAutoUpdate: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: moment().toDate(),
      },
      pagination: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      items: {
        type: Sequelize.STRING,
        defaultValue: "items",
      },
      itemsLimit: {
        type: Sequelize.INTEGER,
        defaultValue: 100,
      },
      offset: {
        type: Sequelize.STRING,
        defaultValue: "offset",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface) => {
    return queryInterface.dropTable("Chart");
  }
};
