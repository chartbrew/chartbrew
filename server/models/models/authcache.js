module.exports = (sequelize, DataTypes) => {
  const AuthCache = sequelize.define("AuthCache", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    user: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
      get() {
        try {
          return JSON.parse(this.getDataValue("user"));
        } catch (e) {
          return this.getDataValue("user");
        }
      },
      set(user) {
        this.setDataValue("user", JSON.stringify(user));
      },
    },
  }, {
    freezeTableName: true,
  });

  return AuthCache;
};
