module.exports = (sequelize, DataTypes) => {
  const Project = sequelize.define("Project", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
    },
    brewName: {
      type: DataTypes.STRING,
      unique: true,
    },
    dashboardTitle: {
      type: DataTypes.STRING,
    },
    description: {
      type: DataTypes.TEXT,
    },
    backgroundColor: {
      type: DataTypes.STRING,
      defaultValue: "#103751",
    },
    titleColor: {
      type: DataTypes.STRING,
      defaultValue: "white",
    },
    headerCode: {
      type: DataTypes.TEXT,
    },
    footerCode: {
      type: DataTypes.TEXT,
    },
    logo: {
      type: DataTypes.STRING,
    },
    logoLink: {
      type: DataTypes.STRING(1234),
    },
    public: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    passwordProtected: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    password: {
      type: DataTypes.STRING,
    },
  }, {
    freezeTableName: true,
  });

  Project.associate = (models) => {
    models.Project.hasMany(models.ProjectRole, { foreignKey: "project_id" });
    models.Project.hasMany(models.Connection, { foreignKey: "project_id" });
    models.Project.hasMany(models.Chart, { foreignKey: "project_id" });
    models.Project.belongsTo(models.Team, { foreignKey: "team_id" });
  };

  return Project;
};
