const simplecrypt = require("simplecrypt");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define("User", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    oneaccountId: {
      type: DataTypes.UUID,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    admin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      get() {
        if (this.getDataValue("email") && this.getDataValue("email").indexOf("@") > -1) {
          return this.getDataValue("email");
        }

        try {
          return sc.decrypt(this.getDataValue("email"));
        } catch (e) {
          return this.getDataValue("email");
        }
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
    },
    icon: {
      type: DataTypes.STRING,
    },
    passwordResetToken: {
      type: DataTypes.STRING,
    },
    tutorials: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "{}",
      set(val) {
        try {
          return this.setDataValue("tutorials", JSON.stringify(val));
        } catch (e) {
          return this.setDataValue("tutorials", val);
        }
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("tutorials"));
        } catch (e) {
          return this.getDataValue("tutorials");
        }
      },
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: sequelize.literal("CURRENT_TIMESTAMP")
    },
  }, {
    freezeTableName: true,
  });

  User.associate = (models) => {
    // associations can be defined here
    models.User.hasMany(models.TeamRole, { foreignKey: "user_id" });
    models.User.hasMany(models.ProjectRole, { foreignKey: "user_id" });
    models.User.hasMany(models.TeamInvitation, { foreignKey: "user_id" });
    models.User.hasMany(models.ChartCache, { foreignKey: "user_id" });
    models.User.hasMany(models.User2fa, { foreignKey: "user_id" });
  };

  User.beforeValidate((user) => {
    user.admin = false; // eslint-disable-line
    return new Promise((resolve) => resolve(user));
  });

  return User;
};
