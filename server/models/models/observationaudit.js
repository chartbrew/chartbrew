const {
  getEncryptedJson,
  setEncryptedJson,
} = require("../../modules/modelEncryptedFields");

module.exports = (sequelize, DataTypes) => {
  const ObservationAudit = sequelize.define("ObservationAudit", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    observation_id: DataTypes.UUID,
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    candidate_fingerprint: DataTypes.STRING,
    audit_mode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    model: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    audit_version: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    verdict: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
      set(value) {
        setEncryptedJson(this, "verdict", value);
      },
      get() {
        return getEncryptedJson(this, "verdict");
      },
    },
    feature_vector: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
      set(value) {
        setEncryptedJson(this, "feature_vector", value);
      },
      get() {
        return getEncryptedJson(this, "feature_vector");
      },
    },
    usage_id: DataTypes.UUID,
  }, {
    freezeTableName: true,
    indexes: [
      { fields: ["team_id", "createdAt"] },
      { fields: ["observation_id"] },
      { fields: ["createdAt"] },
    ],
  });

  ObservationAudit.associate = (models) => {
    models.ObservationAudit.belongsTo(models.Observation, { foreignKey: "observation_id" });
    models.ObservationAudit.belongsTo(models.Team, { foreignKey: "team_id" });
    models.ObservationAudit.belongsTo(models.AiUsage, {
      foreignKey: "usage_id",
      constraints: false,
    });
  };

  return ObservationAudit;
};
