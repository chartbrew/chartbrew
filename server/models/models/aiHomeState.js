const { getEncryptedJson, setEncryptedJson } = require("../../modules/modelEncryptedFields");

module.exports = (sequelize, DataTypes) => {
  const AiHomeState = sequelize.define("AiHomeState", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    team_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    last_active_at: DataTypes.DATE,
    last_attempt_at: DataTypes.DATE,
    forgotten_before: DataTypes.DATE,
    revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    signature: DataTypes.STRING(64),
    payload: {
      type: DataTypes.TEXT("long"),
      get() { return getEncryptedJson(this, "payload") || {}; },
      set(value) { setEncryptedJson(this, "payload", value); },
    },
  }, {
    freezeTableName: true,
    indexes: [{ unique: true, fields: ["team_id", "user_id"] }, { fields: ["last_active_at"] }],
  });
  AiHomeState.associate = (models) => {
    AiHomeState.belongsTo(models.Team, { foreignKey: "team_id", onDelete: "CASCADE" });
    AiHomeState.belongsTo(models.User, { foreignKey: "user_id", onDelete: "CASCADE" });
  };
  return AiHomeState;
};
