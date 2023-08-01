const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Dataset", "goal", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Dataset", "goal");
  }
};
