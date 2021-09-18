module.exports = (sequelize, DataTypes) => {
  const ChartCache = sequelize.define("ChartCache", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      reference: {
        model: "User",
        key: "id",
        onDelete: "cascade",
      },
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
    filePath: {
      type: DataTypes.STRING,
    },
  }, {
    freezeTableName: true,
  });

  return ChartCache;
};
