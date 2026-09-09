const S = require("sequelize");

module.exports = {
  async up(q) {
    const timestamps = { createdAt: { type: S.DATE, allowNull: false }, updatedAt: { type: S.DATE, allowNull: false } };
    await q.createTable("McpOAuthClient", {
      id: { type: S.STRING(64), primaryKey: true, allowNull: false },
      name: { type: S.STRING(80), allowNull: false },
      redirectUris: { type: S.JSON, allowNull: false },
      authMethod: { type: S.STRING(30), allowNull: false },
      secretHash: { type: S.STRING(64) },
      ...timestamps,
    });
    await q.createTable("McpOAuthGrant", {
      id: { type: S.UUID, primaryKey: true, allowNull: false },
      client_id: { type: S.STRING(64), allowNull: false, references: { model: "McpOAuthClient", key: "id" }, onDelete: "CASCADE" },
      user_id: { type: S.INTEGER, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
      team_id: { type: S.INTEGER, references: { model: "Team", key: "id" }, onDelete: "CASCADE" },
      redirectUri: { type: S.TEXT, allowNull: false },
      state: { type: S.TEXT },
      challenge: { type: S.STRING(43), allowNull: false },
      resource: { type: S.TEXT, allowNull: false },
      scopes: { type: S.JSON, allowNull: false },
      project_ids: { type: S.JSON },
      all_projects: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
      codeHash: { type: S.STRING(64), unique: true },
      codeExpiresAt: { type: S.DATE },
      exchangedAt: { type: S.DATE },
      expiresAt: { type: S.DATE, allowNull: false },
      revokedAt: { type: S.DATE },
      ...timestamps,
    });
    await q.addIndex("McpOAuthGrant", ["user_id", "revokedAt"]);
    await q.addIndex("McpOAuthGrant", ["expiresAt"]);
    await q.createTable("McpOAuthRefresh", {
      id: { type: S.STRING(64), primaryKey: true, allowNull: false },
      grant_id: { type: S.UUID, allowNull: false, references: { model: "McpOAuthGrant", key: "id" }, onDelete: "CASCADE" },
      usedAt: { type: S.DATE },
      ...timestamps,
    });
  },
  async down(q) {
    await q.dropTable("McpOAuthRefresh");
    await q.dropTable("McpOAuthGrant");
    await q.dropTable("McpOAuthClient");
  },
};
