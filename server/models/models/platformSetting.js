module.exports = (sequelize, DataTypes) => {
  const PlatformSetting = sequelize.define("PlatformSetting", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false,
      set(value) {
        this.setDataValue("value", JSON.stringify(value));
      },
      get() {
        const value = this.getDataValue("value");
        try {
          return JSON.parse(value);
        } catch (error) {
          return value;
        }
      },
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    freezeTableName: true,
  });

  PlatformSetting.associate = (models) => {
    models.PlatformSetting.belongsTo(models.User, {
      foreignKey: "updated_by",
      onDelete: "SET NULL",
    });
  };

  return PlatformSetting;
};
