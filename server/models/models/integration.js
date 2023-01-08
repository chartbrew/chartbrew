module.exports = (sequelize, DataTypes) => {
  const Integration = sequelize.define("Integration", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
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
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    config: {
      type: DataTypes.TEXT("long"),
      set(val) {
        return this.setDataValue("config", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("config"));
        } catch (e) {
          return this.getDataValue("config");
        }
      }
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

  Integration.associate = (models) => {
    models.Integration.belongsTo(models.Team, { foreignKey: "team_id" });
    models.Integration.hasMany(models.AlertIntegration, { foreignKey: "integration_id" });
  };

  return Integration;
};
