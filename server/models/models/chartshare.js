module.exports = (sequelize, DataTypes) => {
  const Chartshare = sequelize.define("Chartshare", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    chart_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      reference: {
        model: "Chart",
        key: "id",
        onDelete: "cascade",
      },
    },
    shareString: {
      type: DataTypes.STRING,
      required: true,
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

  Chartshare.associate = (models) => {
    models.Chartshare.belongsTo(models.Chart, { foreignKey: "chart_id" });
  };

  return Chartshare;
};
