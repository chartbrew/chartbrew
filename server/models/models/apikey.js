const simplecrypt = require("simplecrypt");

const { encrypt, decrypt } = require("../../modules/cbCrypto");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = (sequelize, DataTypes) => {
  const Apikey = sequelize.define("Apikey", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: false,
      set(val) {
        try {
          return this.setDataValue("token", encrypt(val));
        } catch (e) {
          return this.setDataValue("token", val);
        }
      },
      get() {
        try {
          return decrypt(this.getDataValue("token"));
        } catch (e) {
          // Fallback to old decryption if the new one fails
          try {
            return sc.decrypt(this.getDataValue("token"));
          } catch (e) {
            // Handle the case where neither method works
            return this.getDataValue("token");
          }
        }
      }
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
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    scopes: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
      defaultValue: () => "[]",
      get() {
        try {
          return JSON.parse(this.getDataValue("scopes"));
        } catch (error) {
          return [];
        }
      },
      set(value) {
        return this.setDataValue("scopes", JSON.stringify(value || []));
      },
    },
    project_ids: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      get() {
        const value = this.getDataValue("project_ids");
        if (value === null) return null;

        try {
          return JSON.parse(value);
        } catch (error) {
          return [];
        }
      },
      set(value) {
        return this.setDataValue("project_ids", value === null ? null : JSON.stringify(value));
      },
    },
    all_projects: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
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

  Apikey.associate = (models) => {
    models.Apikey.belongsTo(models.Team, { foreignKey: "team_id" });
    models.Apikey.belongsTo(models.User, { foreignKey: "user_id", constraints: false });
    models.Apikey.hasMany(models.Integration, { foreignKey: "apikey_id" });
  };

  return Apikey;
};
