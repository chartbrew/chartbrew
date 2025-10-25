const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("AiConversation", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      team_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Team",
          key: "id",
          onDelete: "cascade",
        },
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "User",
          key: "id",
          onDelete: "cascade",
        },
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("active", "completed", "error", "cancelled"),
        defaultValue: "active",
      },
      conversation_summary: {
        type: Sequelize.TEXT("long"),
        comment: "Condensed version for resuming conversations",
      },
      full_history: {
        type: Sequelize.TEXT("long"),
        comment: "Full conversation history",
      },
      total_tokens: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      prompt_tokens: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      completion_tokens: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      message_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      tool_calls_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      final_result: {
        type: Sequelize.TEXT,
        comment: "Summary of what was accomplished",
      },
      last_checkpoint: {
        type: Sequelize.TEXT,
        comment: "State for resuming interrupted conversations",
      },
      error_message: {
        type: Sequelize.TEXT,
        comment: "Error details if status = error",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("AiConversation");
  }
};
