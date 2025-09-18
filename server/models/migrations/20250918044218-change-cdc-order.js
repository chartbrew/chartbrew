/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("ChartDatasetConfig", "order", {
      type: Sequelize.FLOAT,
      defaultValue: 1,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("ChartDatasetConfig", "order", {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    });
  }
};
