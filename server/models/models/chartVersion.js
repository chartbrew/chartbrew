module.exports = (sequelize, DataTypes) => {
  const ChartVersion = sequelize.define("ChartVersion", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    chart_id: { type: DataTypes.INTEGER, allowNull: false },
    version: { type: DataTypes.INTEGER, allowNull: false },
    user_id: DataTypes.INTEGER,
    origin: { type: DataTypes.STRING(16), allowNull: false },
    configuration: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
      get() { return JSON.parse(this.getDataValue("configuration")); },
      set(value) { this.setDataValue("configuration", JSON.stringify(value)); },
    },
    summary: { type: DataTypes.STRING, allowNull: false },
    restored_from_version: DataTypes.INTEGER,
    operation_id: DataTypes.STRING(128),
  }, {
    freezeTableName: true,
    updatedAt: false,
    indexes: [
      { unique: true, fields: ["chart_id", "version"] },
      { unique: true, fields: ["chart_id", "operation_id"] },
    ],
  });

  ChartVersion.associate = (models) => {
    ChartVersion.belongsTo(models.Chart, { foreignKey: "chart_id", onDelete: "CASCADE" });
    ChartVersion.belongsTo(models.User, { foreignKey: "user_id", onDelete: "SET NULL" });
  };

  return ChartVersion;
};
