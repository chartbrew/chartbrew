module.exports = (sequelize, DataTypes) => {
  const ObservationPreference = sequelize.define("ObservationPreference", {
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
    read_at: DataTypes.DATE,
    saved_at: DataTypes.DATE,
    dismissed_at: DataTypes.DATE,
    snoozed_until: DataTypes.DATE,
  }, {
    freezeTableName: true,
    indexes: [
      { unique: true, fields: ["observation_id", "user_id"] },
      { fields: ["user_id", "read_at"] },
      { fields: ["user_id", "saved_at"] },
    ],
  });

  ObservationPreference.associate = (models) => {
    models.ObservationPreference.belongsTo(models.Observation, {
      foreignKey: "observation_id",
      onDelete: "CASCADE",
    });
    models.ObservationPreference.belongsTo(models.User, {
      foreignKey: "user_id",
      onDelete: "CASCADE",
    });
  };

  return ObservationPreference;
};
