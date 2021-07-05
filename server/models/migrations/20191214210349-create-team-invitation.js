const Sequelize = require("sequelize");
const simplecrypt = require("simplecrypt");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = {
  up: (queryInterface) => {
    return queryInterface.createTable("TeamInvitation", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        reference: {
          model: "User",
          key: "id",
          onDelete: "cascade",
        },
      },
      team_id: {
        type: Sequelize.INTEGER,
        reference: {
          model: "Team",
          key: "id",
          onDelete: "cascade",
        },
      },
      token: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        get() {
          try {
            return sc.decrypt(this.getDataValue("email"));
          } catch (e) {
            return this.getDataValue("email");
          }
        },
        set(value) {
          return this.setDataValue("email", sc.encrypt(value));
        },
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface) => {
    return queryInterface.dropTable("TeamInvitation");
  }
};
