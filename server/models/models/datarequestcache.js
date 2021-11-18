module.exports = (sequelize, DataTypes) => {
  const DataRequestCache = sequelize.define("DataRequestCache", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    dr_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      reference: {
        model: "DataRequest",
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

  return DataRequestCache;
};
