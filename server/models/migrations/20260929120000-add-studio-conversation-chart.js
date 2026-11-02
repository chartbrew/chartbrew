const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("AiConversation", "studio_chart_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addIndex("AiConversation", ["team_id", "user_id", "studio_chart_id", "updatedAt"], {
      name: "ai_conversation_studio_history",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("AiConversation", "ai_conversation_studio_history");
    await queryInterface.removeColumn("AiConversation", "studio_chart_id");
  },
};
