module.exports = (sequelize, DataTypes) => {
  const SlackLinkToken = sequelize.define("SlackLinkToken", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    token_hash: { type: DataTypes.STRING, allowNull: false },
    integration_id: { type: DataTypes.UUID, allowNull: false },
    team_id: { type: DataTypes.INTEGER, allowNull: false },
    slack_user_id: { type: DataTypes.STRING, allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
  }, {
    freezeTableName: true,
    indexes: [{ unique: true, fields: ["token_hash"] }],
  });

  return SlackLinkToken;
};
