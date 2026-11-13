module.exports = (sequelize, DataTypes) => {
  const SlackRequest = sequelize.define("SlackRequest", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    request_key: { type: DataTypes.STRING, allowNull: false },
    account_id: { type: DataTypes.UUID, allowNull: true },
    team_id: { type: DataTypes.INTEGER, allowNull: true },
    integration_id: { type: DataTypes.UUID, allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true },
    thread_id: { type: DataTypes.UUID, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false },
    input: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
      get() { return JSON.parse(this.getDataValue("input") || "null"); },
      set(value) { this.setDataValue("input", JSON.stringify(value)); },
    },
    result: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      get() { return JSON.parse(this.getDataValue("result") || "null"); },
      set(value) { this.setDataValue("result", JSON.stringify(value)); },
    },
    messages: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      get() { return JSON.parse(this.getDataValue("messages") || "null"); },
      set(value) { this.setDataValue("messages", JSON.stringify(value)); },
    },
    progress_ts: { type: DataTypes.STRING, allowNull: true },
    access_version: { type: DataTypes.STRING, allowNull: true },
  }, {
    freezeTableName: true,
    indexes: [{ unique: true, fields: ["request_key"] }],
  });

  return SlackRequest;
};
