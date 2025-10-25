const zlib = require("zlib");

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
    // Condensed conversation history (token-efficient)
    conversation_summary: {
      type: DataTypes.TEXT("long"),
      comment: "Condensed version for resuming conversations"
    },
    // Full history for detailed review (compressed)
    full_history: {
      type: DataTypes.TEXT("long"),
      set(val) {
        // Compress full conversation data
        const compressed = zlib.gzipSync(
          Buffer.from(JSON.stringify(val))
        ).toString("base64");
        return this.setDataValue("full_history", compressed);
      },
      get() {
        try {
          const compressed = this.getDataValue("full_history");
          return JSON.parse(
            zlib.gunzipSync(
              Buffer.from(compressed, "base64")
            ).toString()
          );
        } catch (e) {
          return null;
        }
      }
    },
    // Token usage tracking
    total_tokens: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    prompt_tokens: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    completion_tokens: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    // Conversation metadata
    message_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    tool_calls_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
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
      { fields: ["team_id", "user_id"] },
      { fields: ["status", "updatedAt"] }
    ]
  });

  AiConversation.associate = (models) => {
    models.AiConversation.belongsTo(models.User, { foreignKey: "user_id" });
    models.AiConversation.belongsTo(models.Team, { foreignKey: "team_id" });
  };

  return AiConversation;
};
