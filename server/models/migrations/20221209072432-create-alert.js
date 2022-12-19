const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("Alert", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      chart_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        reference: {
          model: "Chart",
          key: "id",
          onDelete: "cascade",
        },
      },
      dataset_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        reference: {
          model: "Dataset",
          key: "id",
          onDelete: "cascade",
        },
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      rules: {
        type: Sequelize.TEXT("long"),
        set(val) {
          return this.setDataValue("rules", JSON.stringify(val));
        },
        get() {
          try {
            return JSON.parse(this.getDataValue("rules"));
          } catch (e) {
            return this.getDataValue("rules");
          }
        }
      },
      recipients: {
        type: Sequelize.TEXT,
        set(val) {
          return this.setDataValue("recipients", JSON.stringify(val));
        },
        get() {
          try {
            return JSON.parse(this.getDataValue("recipients"));
          } catch (e) {
            return this.getDataValue("recipients");
          }
        },
      },
      mediums: {
        type: Sequelize.TEXT,
        set(val) {
          return this.setDataValue("mediums", JSON.stringify(val));
        },
        get() {
          try {
            return JSON.parse(this.getDataValue("mediums"));
          } catch (e) {
            return this.getDataValue("mediums");
          }
        },
      },
      active: {
        type: Sequelize.BOOLEAN,
        required: true,
        defaultValue: false,
      },
      token: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        required: true,
      },
      oneTime: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        required: true,
      },
      timeout: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        required: true,
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
    await queryInterface.dropTable("Alert");
  }
};
