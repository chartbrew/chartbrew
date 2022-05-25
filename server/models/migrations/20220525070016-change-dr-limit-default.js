const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.changeColumn("DataRequest", "itemsLimit", {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.changeColumn("DataRequest", "itemsLimit", {
      type: Sequelize.INTEGER,
      defaultValue: 100,
    });
  }
};
