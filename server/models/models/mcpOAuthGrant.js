module.exports = (sequelize, D) => {
  const Grant = sequelize.define(
    "McpOAuthGrant",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      client_id: { type: D.STRING(64), allowNull: false },
      user_id: D.INTEGER,
      team_id: D.INTEGER,
      redirectUri: { type: D.TEXT, allowNull: false },
      state: D.TEXT,
      challenge: { type: D.STRING(43), allowNull: false },
      resource: { type: D.TEXT, allowNull: false },
      scopes: {
        type: D.JSON,
        allowNull: false,
        get() {
          const value = this.getDataValue("scopes");
          return typeof value === "string" ? JSON.parse(value) : value;
        },
      },
      project_ids: {
        type: D.JSON,
        get() {
          const value = this.getDataValue("project_ids");
          return typeof value === "string" ? JSON.parse(value) : value;
        },
      },
      all_projects: { type: D.BOOLEAN, allowNull: false, defaultValue: false },
      codeHash: { type: D.STRING(64), unique: true },
      codeExpiresAt: D.DATE,
      exchangedAt: D.DATE,
      expiresAt: { type: D.DATE, allowNull: false },
      revokedAt: D.DATE,
    },
    { freezeTableName: true }
  );
  Grant.associate = (db) => {
    Grant.belongsTo(db.McpOAuthClient, { foreignKey: "client_id", onDelete: "CASCADE" });
    Grant.belongsTo(db.User, { foreignKey: "user_id", onDelete: "CASCADE" });
    Grant.belongsTo(db.Team, { foreignKey: "team_id", onDelete: "CASCADE" });
  };
  return Grant;
};
