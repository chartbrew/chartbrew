const Sequelize = require("sequelize");
const addDatasetSettingsToChartDataset = require("../scripts/addDatasetSettingsToChartDataset");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("ChartDatasetConfig", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      chart_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Chart",
          key: "id",
        },
        onDelete: "cascade",
      },
      dataset_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Dataset",
          key: "id",
        },
        onDelete: "cascade",
      },
      formula: {
        type: Sequelize.TEXT,
      },
      datasetColor: {
        type: Sequelize.TEXT,
      },
      fillColor: {
        type: Sequelize.TEXT,
      },
      fill: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      multiFill: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      legend: {
        type: Sequelize.STRING,
      },
      pointRadius: {
        type: Sequelize.INTEGER,
      },
      excludedFields: {
        type: Sequelize.TEXT,
      },
      sort: {
        type: Sequelize.STRING,
      },
      columnsOrder: {
        type: Sequelize.TEXT,
      },
      order: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      maxRecords: {
        type: Sequelize.INTEGER,
      },
      goal: {
        type: Sequelize.INTEGER,
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

    await addDatasetSettingsToChartDataset.up(queryInterface);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ChartDatasetConfig");
  }
};
