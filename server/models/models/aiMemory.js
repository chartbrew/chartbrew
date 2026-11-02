const { getEncryptedJson, setEncryptedJson } = require("../../modules/modelEncryptedFields");

module.exports = (sequelize, DataTypes) => {
  const AiMemory = sequelize.define("AiMemory", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    team_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
      get() { return getEncryptedJson(this, "text"); },
      set(value) { setEncryptedJson(this, "text", value); },
    },
  }, { freezeTableName: true, indexes: [{ fields: ["team_id", "user_id"] }] });
  AiMemory.associate = (models) => {
    AiMemory.belongsTo(models.Team, { foreignKey: "team_id", onDelete: "CASCADE" });
    AiMemory.belongsTo(models.User, { foreignKey: "user_id", onDelete: "CASCADE" });
  };
  return AiMemory;
};
