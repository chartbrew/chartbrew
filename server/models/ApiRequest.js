const db = require("../modules/dbConnection");
const Sequelize = require("sequelize");
const simplecrypt = require("simplecrypt");
const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

const ApiRequest = db.define("ApiRequest", {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
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
  method: {
    type: Sequelize.STRING,
  },
  route: {
    type: Sequelize.TEXT,
  },
  headers: {
    type: Sequelize.TEXT,
    set(val) {
      return this.setDataValue("headers", sc.encrypt(JSON.stringify(val)));
    },
    get() {
      try {
        return JSON.parse(sc.decrypt(this.getDataValue("headers")));
      } catch (e) {
        return this.getDataValue("headers");
      }
    }
  },
  body: {
    type: Sequelize.TEXT,
    set(val) {
      return this.setDataValue("body", sc.encrypt(val));
    },
    get() {
      try {
        return sc.decrypt(this.getDataValue("body"));
      } catch (e) {
        return this.getDataValue("body");
      }
    }
  },
  useGlobalHeaders: {
    type: Sequelize.BOOLEAN,
    required: true,
    defaultValue: true,
  },
}, {
  freezeTableName: true
});

module.exports = ApiRequest;
