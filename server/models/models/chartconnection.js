module.exports = (sequelize, DataTypes) => {
  const ChartConnection = sequelize.define("ChartConnection", {
    chart_id: DataTypes.INTEGER,
    connection_id: DataTypes.INTEGER,
  }, {
    freezeTableName: true,
  });

  return ChartConnection;
};
