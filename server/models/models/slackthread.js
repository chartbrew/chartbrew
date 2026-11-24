module.exports = (sequelize, DataTypes) => {
  const SlackThread = sequelize.define("SlackThread", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    account_id: { type: DataTypes.UUID, allowNull: true },
    team_id: { type: DataTypes.INTEGER, allowNull: true },
    integration_id: { type: DataTypes.UUID, allowNull: true },
    shared_key: { type: DataTypes.STRING, allowNull: true, unique: true },
    channel_id: { type: DataTypes.STRING, allowNull: false },
    thread_ts: { type: DataTypes.STRING, allowNull: false },
    conversation_id: { type: DataTypes.UUID, allowNull: false },
    dm_channel: { type: DataTypes.STRING, allowNull: true },
    dm_thread_ts: { type: DataTypes.STRING, allowNull: true },
  }, {
    freezeTableName: true,
    indexes: [{ unique: true, fields: ["account_id", "channel_id", "thread_ts"] }],
  });

  return SlackThread;
};
