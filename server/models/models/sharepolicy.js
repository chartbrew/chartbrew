module.exports = (sequelize, DataTypes) => {
  const SharePolicy = sequelize.define("SharePolicy", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    entity_type: {
      type: DataTypes.ENUM("Project", "Chart"),
      allowNull: false,
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    visibility: {
      type: DataTypes.ENUM("public", "private", "password", "disabled"),
      // public: anyone can view
      // private: can be viewed with signed URL
      // password: anyone can view with a password
      // disabled: the share policy is disabled - no one can view
    },
    params: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    allow_params: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    password: {
      type: DataTypes.STRING,
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  }, {
    freezeTableName: true,
  });

  // SharePolicy.associate = (models) => {
  //   models.SharePolicy.belongsTo(models.Project, { foreignKey: "entity_id" });
  //   models.SharePolicy.belongsTo(models.Chart, { foreignKey: "entity_id" });
  // };

  return SharePolicy;
};
