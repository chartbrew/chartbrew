const Sequelize = require("sequelize");
const simplecrypt = require("simplecrypt");
const db = require("../modules/dbConnection");
const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

const User = db.define("User", {
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
}, {
  freezeTableName: true
});

User.prototype.decryptValue = (val) => {
  return sc.decrypt(val);
};

module.exports = User;
