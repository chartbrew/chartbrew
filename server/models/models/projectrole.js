module.exports = (sequelize, DataTypes) => {
  const ProjectRole = sequelize.define("ProjectRole", {
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
    project_id: {
      type: DataTypes.INTEGER,
      reference: {
        model: "Project",
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

  return ProjectRole;
};
