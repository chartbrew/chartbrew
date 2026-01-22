const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("SlackAuthState", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      state_token: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      integration_type: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "slack",
      },
      external_workspace_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      external_user_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("SlackAuthState", ["state_token"], {
      unique: true,
      name: "slack_auth_state_token_unique",
    });

    await queryInterface.addIndex("SlackAuthState", ["expires_at"], {
      name: "slack_auth_state_expires_at_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("SlackAuthState");
  },
};
