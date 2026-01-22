const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("AiConversation", "source", {
      type: Sequelize.ENUM("slack", "app", "api"),
      allowNull: false,
      defaultValue: "app",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("AiConversation", "source");
  }
};
