const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("AlertEvent", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      alert_id: {
        type: Sequelize.UUID,
        allowNull: false,
        reference: {
          model: "Alert",
          key: "id",
          onDelete: "cascade",
        },
      },
      trigger: {
        type: Sequelize.TEXT,
        set(val) {
          return this.setDataValue("trigger", JSON.stringify(val));
        },
        get() {
          try {
            return JSON.parse(this.getDataValue("trigger"));
          } catch (e) {
            return this.getDataValue("trigger");
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
    await queryInterface.dropTable("AlertEvent");
  }
};
