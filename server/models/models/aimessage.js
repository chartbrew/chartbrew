module.exports = (sequelize, DataTypes) => {
  const AiMessage = sequelize.define("AiMessage", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    conversation_id: {
      type: DataTypes.UUID,
      allowNull: false,
      reference: {
        model: "AiConversation",
        key: "id",
        onDelete: "cascade",
      },
    },
    role: {
      type: DataTypes.ENUM("user", "assistant", "system", "tool"),
      allowNull: false,
      comment: "Message role in the conversation"
    },
    content: {
      type: DataTypes.TEXT("long"),
      comment: "Main message content"
    },
    tool_calls: {
      type: DataTypes.TEXT("long"),
      get() {
        try {
          return JSON.parse(this.getDataValue("tool_calls"));
        } catch (e) {
          return this.getDataValue("tool_calls");
        }
      },
      set(value) {
        try {
          this.setDataValue("tool_calls", JSON.stringify(value));
        } catch (e) {
          this.setDataValue("tool_calls", value);
        }
      },
      comment: "Array of tool calls if role=assistant: [{id, function: {name, arguments}}]"
    },
    tool_name: {
      type: DataTypes.STRING,
      comment: "Tool name if role=tool"
    },
    tool_call_id: {
      type: DataTypes.STRING,
      comment: "Tool call ID reference if role=tool"
    },
    tool_result_preview: {
      type: DataTypes.TEXT,
      comment: "Truncated tool result for UI preview (first 500 chars)"
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Order of message in conversation (0-indexed)"
    },
  }, {
    freezeTableName: true,
    indexes: [
      { fields: ["conversation_id", "sequence"] },
      { fields: ["conversation_id", "role"] },
    ]
  });

  AiMessage.associate = (models) => {
    models.AiMessage.belongsTo(models.AiConversation, { foreignKey: "conversation_id" });
  };

  return AiMessage;
};
