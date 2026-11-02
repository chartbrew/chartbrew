module.exports = (sequelize, DataTypes) => {
  const ReportThemePreset = sequelize.define("ReportThemePreset", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    team_id: { type: DataTypes.INTEGER, allowNull: false },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    name: { type: DataTypes.STRING(80), allowNull: false },
    appearance: {
      type: DataTypes.JSON,
      allowNull: false,
      get() {
        const value = this.getDataValue("appearance");
        return typeof value === "string" ? JSON.parse(value) : value;
      },
    },
    revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { freezeTableName: true });

  ReportThemePreset.associate = (models) => {
    ReportThemePreset.belongsTo(models.Team, { foreignKey: "team_id", onDelete: "CASCADE" });
    ReportThemePreset.belongsTo(models.User, { foreignKey: "created_by", onDelete: "SET NULL" });
  };
  return ReportThemePreset;
};
