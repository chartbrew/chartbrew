const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("AiMessage", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "AiConversation",
          key: "id",
          onDelete: "cascade",
        },
      },
      role: {
        type: Sequelize.ENUM("user", "assistant", "system", "tool"),
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT("long"),
      },
      tool_calls: {
        type: Sequelize.JSON,
      },
      tool_name: {
        type: Sequelize.STRING,
      },
      tool_call_id: {
        type: Sequelize.STRING,
      },
      tool_result_preview: {
        type: Sequelize.TEXT,
      },
      sequence: {
        type: Sequelize.INTEGER,
        allowNull: false,
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
    await queryInterface.addIndex("AiMessage", ["conversation_id", "sequence"]);
    await queryInterface.addIndex("AiMessage", ["conversation_id", "role"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("AiMessage");
  }
};
