module.exports = (sequelize, DataTypes) => {
  const AiConversationContext = sequelize.define("AiConversationContext", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    conversation_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    entity_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    entity_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    freezeTableName: true,
    indexes: [
      { unique: true, fields: ["conversation_id", "entity_type", "entity_id"] },
      { fields: ["team_id", "entity_type", "entity_id"] },
    ],
  });

  AiConversationContext.associate = (models) => {
    models.AiConversationContext.belongsTo(models.AiConversation, {
      foreignKey: "conversation_id",
    });
    models.AiConversationContext.belongsTo(models.Team, { foreignKey: "team_id" });
  };

  return AiConversationContext;
};
