const simplecrypt = require("simplecrypt");
const Sequelize = require("sequelize");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = {
  up: (queryInterface, DataTypes) => {
    return queryInterface.createTable("User", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      surname: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
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
        type: DataTypes.DATE,
      },
      active: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        required: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        set(val) {
          return this.setDataValue("password", sc.encrypt(val));
        },
      },
      icon: {
        type: DataTypes.STRING,
      },
      passwordResetToken: {
        type: DataTypes.STRING,
      },
      stripeId: {
        type: Sequelize.STRING,
        set(val) {
          return this.setDataValue("stripeId", sc.encrypt(val));
        },
      },
      subscriptionId: {
        type: Sequelize.STRING,
        set(val) {
          return this.setDataValue("subscriptionId", sc.encrypt(val));
        },
      },
      plan: {
        type: Sequelize.STRING,
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => { // eslint-disable-line
    return queryInterface.dropTable("User");
  }
};
