const simplecrypt = require("simplecrypt");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = (sequelize, DataTypes) => {
  const OAuth = sequelize.define("OAuth", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      reference: {
        model: "Team",
        key: "id",
        onDelete: "cascade",
      },
    },
    refreshToken: {
      type: DataTypes.TEXT,
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
      type: DataTypes.DATE
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE
    },
  }, {
    freezeTableName: true,
  });

  OAuth.associate = (models) => {
    models.OAuth.hasMany(models.Connection, { foreignKey: "oauth_id" });
  };

  return OAuth;
};
