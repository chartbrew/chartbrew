module.exports = (sequelize, DataTypes) => {
  const SlackAccount = sequelize.define("SlackAccount", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    integration_id: { type: DataTypes.UUID, allowNull: false },
    team_id: { type: DataTypes.INTEGER, allowNull: false },
    slack_user_id: { type: DataTypes.STRING, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    freezeTableName: true,
    indexes: [{ unique: true, fields: ["integration_id", "slack_user_id"] }],
  });

  return SlackAccount;
};
