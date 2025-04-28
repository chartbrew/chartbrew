module.exports = (sequelize, DataTypes) => {
  const PinnedDashboard = sequelize.define("PinnedDashboard", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Team",
        key: "id",
        onDelete: "cascade",
      },
    },
    project_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Project",
        key: "id",
        onDelete: "cascade",
      },
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "User",
        key: "id",
        onDelete: "cascade",
      },
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

  PinnedDashboard.associate = (models) => {
    models.PinnedDashboard.belongsTo(models.Team, { foreignKey: "team_id" });
    models.PinnedDashboard.belongsTo(models.Project, { foreignKey: "project_id" });
    models.PinnedDashboard.belongsTo(models.User, { foreignKey: "user_id" });
  };

  return PinnedDashboard;
};
