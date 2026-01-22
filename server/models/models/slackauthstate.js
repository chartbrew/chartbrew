module.exports = (sequelize, DataTypes) => {
  const SlackAuthState = sequelize.define("SlackAuthState", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    state_token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    integration_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "slack",
    },
    external_workspace_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    external_user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  }, {
    freezeTableName: true,
  });

  return SlackAuthState;
};
