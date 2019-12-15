module.exports = (sequelize, DataTypes) => {
  const TeamRole = sequelize.define("TeamRole", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      reference: {
        model: "User",
        key: "id",
        onDelete: "cascade",
      },
    },
    team_id: {
      type: DataTypes.INTEGER,
      reference: {
        model: "Team",
        key: "id",
        onDelete: "cascade",
      },
    },
    role: {
      type: DataTypes.STRING,
      defaultValue: "admin",
    },
  }, {
    freezeTableName: true,
  });

  TeamRole.associate = (models) => {
    models.TeamRole.belongsTo(models.User, { foreignKey: "user_id" });
    models.TeamRole.belongsTo(models.Team, { foreignKey: "team_id" });
  };

  return TeamRole;
};
