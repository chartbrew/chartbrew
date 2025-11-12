module.exports = (sequelize, DataTypes) => {
  const AiConversation = sequelize.define("AiConversation", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      reference: {
        model: "Team",
        key: "id",
        onDelete: "cascade",
      },
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      reference: {
        model: "User",
        key: "id",
        onDelete: "cascade",
      },
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Auto-generated conversation title"
    },
    status: {
      type: DataTypes.ENUM("active", "completed", "error", "cancelled"),
      defaultValue: "active",
    },
    // Condensed conversation history (token-efficient, rebuildable from AiMessage)
    conversation_summary: {
      type: DataTypes.TEXT("long"),
      comment: "Cached condensed version for resuming conversations efficiently"
    },
    // Conversation metadata (cached counts)
    message_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Cached count of user messages"
    },
    // Final results summary
    final_result: {
      type: DataTypes.TEXT,
      comment: "Summary of what was accomplished"
    },
    // Resume checkpoint
    last_checkpoint: {
      type: DataTypes.TEXT,
      comment: "State for resuming interrupted conversations"
    },
    error_message: {
      type: DataTypes.TEXT,
      comment: "Error details if status = error"
    },
  }, {
    freezeTableName: true,
    indexes: [
      { fields: ["team_id", "user_id", "updatedAt"] },
      { fields: ["status", "updatedAt"] }
    ]
  });

  AiConversation.associate = (models) => {
    models.AiConversation.belongsTo(models.User, { foreignKey: "user_id" });
    models.AiConversation.belongsTo(models.Team, { foreignKey: "team_id" });
    models.AiConversation.hasMany(models.AiMessage, { foreignKey: "conversation_id" });
    models.AiConversation.hasMany(models.AiUsage, { foreignKey: "conversation_id" });
  };

  return AiConversation;
};
