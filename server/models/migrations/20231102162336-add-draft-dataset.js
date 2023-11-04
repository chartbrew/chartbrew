const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Dataset", "draft", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.bulkUpdate("Dataset", { draft: false }, {});
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Dataset", "draft");
  }
};
