const Sequelize = require("sequelize");
const simplecrypt = require("simplecrypt");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("OAuth", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
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
      refreshToken: {
        type: Sequelize.TEXT,
        set(val) {
          try {
            return this.setDataValue("refreshToken", sc.encrypt(val));
          } catch (e) {
            return this.setDataValue("refreshToken", val);
          }
        },
        get() {
          try {
            return sc.decrypt(this.getDataValue("refreshToken"));
          } catch (e) {
            return this.getDataValue("refreshToken");
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
    await queryInterface.dropTable("OAuth");
  }
};
