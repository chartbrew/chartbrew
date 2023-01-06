const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("Integration", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      team_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        reference: {
          model: "Team",
          key: "id",
          onDelete: "cascade",
        },
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      config: {
        type: Sequelize.TEXT("long"),
        set(val) {
          return this.setDataValue("config", JSON.stringify(val));
        },
        get() {
          try {
            return JSON.parse(this.getDataValue("config"));
          } catch (e) {
            return this.getDataValue("config");
          }
        }
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
    await queryInterface.dropTable("Integration");
  }
};
