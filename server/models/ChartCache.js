const Sequelize = require("sequelize");
const simplecrypt = require("simplecrypt");

const db = require("../modules/dbConnection");
const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

const ChartCache = db.define("ChartCache", {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
    reference: {
      model: "User",
      key: "id",
      onDelete: "cascade",
    },
  },
  data: {
    type: Sequelize.TEXT("long"),
    allowNull: false,
    get() {
      try {
        return JSON.parse(sc.decrypt(this.getDataValue("data")));
      } catch (e) {
        return this.getDataValue("data");
      }
    },
    set(val) {
      return this.setDataValue("data", sc.encrypt(JSON.stringify(val)));
    },
  },
}, {
  freezeTableName: true
});

module.exports = ChartCache;
