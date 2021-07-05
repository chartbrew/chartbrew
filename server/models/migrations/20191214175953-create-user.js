const simplecrypt = require("simplecrypt");
const Sequelize = require("sequelize");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = {
  up: (queryInterface) => {
    return queryInterface.createTable("User", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      surname: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        get() {
          try {
            return sc.decrypt(this.getDataValue("email"));
          } catch (e) {
            return this.getDataValue("email");
          }
        },
        set(val) {
          return this.setDataValue("email", sc.encrypt(val));
        },
      },
      lastLogin: {
        type: Sequelize.DATE,
      },
      active: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        required: true,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
        set(val) {
          return this.setDataValue("password", sc.encrypt(val));
        },
      },
      icon: {
        type: Sequelize.STRING,
      },
      passwordResetToken: {
        type: Sequelize.STRING,
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface) => {
    return queryInterface.dropTable("User");
  }
};
