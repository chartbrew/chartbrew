module.exports = (sequelize, D) => sequelize.define("McpOAuthClient", {
  id: { type: D.STRING(64), primaryKey: true },
  name: { type: D.STRING(80), allowNull: false },
  redirectUris: { type: D.JSON, allowNull: false,
    get() {
      const value = this.getDataValue("redirectUris");
      return typeof value === "string" ? JSON.parse(value) : value;
    },
  },
  authMethod: { type: D.STRING(30), allowNull: false },
  secretHash: D.STRING(64),
}, { freezeTableName: true });
