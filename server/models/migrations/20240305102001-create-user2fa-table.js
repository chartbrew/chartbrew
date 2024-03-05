const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("User2fa", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
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
      method: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      secret: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      isEnabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      backup: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("User2fa");
  }
};
