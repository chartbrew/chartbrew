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
    projects: {
      type: DataTypes.TEXT,
      get() {
        try {
          return JSON.parse(this.getDataValue("projects"));
        } catch (e) {
          return this.getDataValue("projects");
        }
      },
      set(val) {
        return this.setDataValue("projects", JSON.stringify(val));
      }
    },
    role: {
      type: DataTypes.STRING,
      defaultValue: "admin",
    },
    canExport: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      set(val) {
        return this.setDataValue("canExport", val);
      }
    },
  }, {
    freezeTableName: true,
  });

  TeamRole.associate = (models) => {
    models.TeamRole.belongsTo(models.User, { foreignKey: "user_id" });
    models.TeamRole.belongsTo(models.Team, { foreignKey: "team_id" });
  };

  // TeamRole.beforeValidate((teamRole) => {
  //   if (teamRole.role === "owner" || teamRole.role === "admin") {
  //     teamRole.canExport = true; // eslint-disable-line
  //   }

  //   return new Promise((resolve) => resolve(teamRole));
  // });

  return TeamRole;
};
