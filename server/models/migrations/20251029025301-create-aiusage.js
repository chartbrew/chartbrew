const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("AiUsage", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "AiConversation",
          key: "id",
          onDelete: "set null",
        },
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
      model: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      prompt_tokens: {
        type: Sequelize.INTEGER,
      },
      completion_tokens: {
        type: Sequelize.INTEGER,
      },
      total_tokens: {
        type: Sequelize.INTEGER,
      },
      elapsed_ms: {
        type: Sequelize.INTEGER,
      },
      cost_micros: {
        type: Sequelize.BIGINT,
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
    await queryInterface.addIndex("AiUsage", ["conversation_id"]);
    await queryInterface.addIndex("AiUsage", ["team_id", "createdAt"]);
    await queryInterface.addIndex("AiUsage", ["team_id", "model", "createdAt"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("AiUsage");
  }
};
