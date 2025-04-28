module.exports = (sequelize, DataTypes) => {
  const DashboardFilter = sequelize.define("DashboardFilter", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
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
    configuration: {
      type: DataTypes.TEXT,
      allowNull: false,
      get() {
        try {
          return JSON.parse(this.getDataValue("configuration"));
        } catch (error) {
          return {};
        }
      },
      set(value) {
        try {
          this.setDataValue("configuration", JSON.stringify(value));
        } catch (error) {
          this.setDataValue("configuration", "{}");
        }
      },
    },
    onReport: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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

  DashboardFilter.associate = (models) => {
    models.DashboardFilter.belongsTo(models.Project, { foreignKey: "project_id" });
  };

  return DashboardFilter;
};
