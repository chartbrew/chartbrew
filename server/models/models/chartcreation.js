module.exports = (sequelize, DataTypes) => {
  const ChartCreation = sequelize.define("ChartCreation", {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    request_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    team_id: { type: DataTypes.INTEGER, allowNull: false },
    project_id: { type: DataTypes.INTEGER, allowNull: false },
    chart_id: DataTypes.INTEGER,
    dataset_id: DataTypes.INTEGER,
    connection_id: DataTypes.INTEGER,
    action: { type: DataTypes.STRING, allowNull: false },
    input_hash: { type: DataTypes.STRING(64), allowNull: false },
    state: { type: DataTypes.STRING, allowNull: false, defaultValue: "running" },
    phase: { type: DataTypes.STRING, defaultValue: "finding" },
    deadline: { type: DataTypes.DATE, allowNull: false },
    result: {
      type: DataTypes.TEXT,
      get() { return JSON.parse(this.getDataValue("result") || "null"); },
      set(value) { this.setDataValue("result", JSON.stringify(value)); },
    },
  }, {
    freezeTableName: true,
    indexes: [{ unique: true, fields: ["user_id", "project_id", "request_id"] }],
  });

  ChartCreation.associate = (models) => {
    ChartCreation.belongsTo(models.Project, { foreignKey: "project_id", onDelete: "CASCADE" });
    ChartCreation.belongsTo(models.User, { foreignKey: "user_id", onDelete: "CASCADE" });
    ChartCreation.belongsTo(models.Team, { foreignKey: "team_id", onDelete: "CASCADE" });
  };
  return ChartCreation;
};
