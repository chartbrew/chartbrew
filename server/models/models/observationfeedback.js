module.exports = (sequelize, DataTypes) => {
  const ObservationFeedback = sequelize.define("ObservationFeedback", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    observation_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    verdict: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    reason_code: DataTypes.STRING,
  }, {
    freezeTableName: true,
    indexes: [
      { unique: true, fields: ["observation_id", "user_id"] },
      { fields: ["observation_id", "verdict"] },
    ],
  });

  ObservationFeedback.associate = (models) => {
    models.ObservationFeedback.belongsTo(models.Observation, { foreignKey: "observation_id" });
    models.ObservationFeedback.belongsTo(models.User, { foreignKey: "user_id" });
  };

  return ObservationFeedback;
};
