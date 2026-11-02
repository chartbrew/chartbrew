const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("AiMemory", {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      team_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "Team", key: "id" }, onDelete: "CASCADE" },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
      text: { type: Sequelize.TEXT, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("AiMemory", ["team_id", "user_id"]);
  },
  async down(queryInterface) { await queryInterface.dropTable("AiMemory"); },
};
