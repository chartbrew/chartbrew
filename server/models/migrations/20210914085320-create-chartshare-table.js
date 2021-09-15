const Sequelize = require("sequelize");

const createChartShares = require("../scripts/createChartShares");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("Chartshare", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
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
      shareString: {
        type: Sequelize.STRING,
        required: true,
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

    // now create a new Chartshare for all the charts in the database
    await createChartShares.up();
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("Chartshare");
  },
};
