const Sequelize = require("sequelize");
const simplecrypt = require("simplecrypt");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("Template", {
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
        required: true,
      },
      model: {
        type: Sequelize.TEXT("long"),
        set(val) {
          try {
            return this.setDataValue("model", sc.encrypt(JSON.stringify(val)));
          } catch (e) {
            return this.setDataValue("model", val);
          }
        },
        get() {
          try {
            return JSON.parse(sc.decrypt(this.getDataValue("model")));
          } catch (e) {
            return this.getDataValue("model");
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

  down: async (queryInterface) => {
    await queryInterface.dropTable("Template");
  }
};
