const simplecrypt = require("simplecrypt");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = (sequelize, DataTypes) => {
  const ChartCache = sequelize.define("ChartCache", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      reference: {
        model: "User",
        key: "id",
        onDelete: "cascade",
      },
    },
    chart_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      reference: {
        model: "Chart",
        key: "id",
        onDelete: "cascade",
      },
    },
    data: {
      type: DataTypes.TEXT("long"),
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
    freezeTableName: true,
  });

  return ChartCache;
};
