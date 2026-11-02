module.exports = (sequelize, DataTypes) => {
  const DataHealthDismissal = sequelize.define("DataHealthDismissal", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    issue_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    freezeTableName: true,
    indexes: [{
      fields: ["team_id", "user_id", "issue_id"],
      name: "data_health_dismissal_unique",
      unique: true,
    }],
  });

  DataHealthDismissal.associate = (models) => {
    models.DataHealthDismissal.belongsTo(models.Team, {
      foreignKey: "team_id",
      onDelete: "CASCADE",
    });
    models.DataHealthDismissal.belongsTo(models.User, {
      foreignKey: "user_id",
      onDelete: "CASCADE",
    });
  };

  return DataHealthDismissal;
};
