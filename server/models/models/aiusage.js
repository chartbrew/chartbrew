module.exports = (sequelize, DataTypes) => {
  const AiUsage = sequelize.define("AiUsage", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    conversation_id: {
      type: DataTypes.UUID,
      allowNull: true, // Allow null so usage records persist after conversation deletion
      reference: {
        model: "AiConversation",
        key: "id",
        onDelete: "set null", // Keep usage records for billing/audit even when conversation is deleted
      },
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      reference: {
        model: "Team",
        key: "id",
        onDelete: "cascade",
      },
      comment: "Denormalized for billing queries"
    },
    model: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "OpenAI model used (e.g. gpt-4o-mini)"
    },
    prompt_tokens: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    completion_tokens: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    total_tokens: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    elapsed_ms: {
      type: DataTypes.INTEGER,
      comment: "API call duration in milliseconds"
    },
    cost_micros: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
      comment: "Cost in micro-dollars (1/1,000,000 of a dollar) for precise billing"
    },
  }, {
    freezeTableName: true,
    indexes: [
      { fields: ["conversation_id"] },
      { fields: ["team_id", "createdAt"] }, // Most important for billing queries
      { fields: ["team_id", "model", "createdAt"] }, // For model-specific billing
    ]
  });

  AiUsage.associate = (models) => {
    models.AiUsage.belongsTo(models.AiConversation, { foreignKey: "conversation_id" });
    models.AiUsage.belongsTo(models.Team, { foreignKey: "team_id" });
  };

  return AiUsage;
};
