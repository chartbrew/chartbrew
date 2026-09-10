module.exports = (sequelize, D) => {
  const Refresh = sequelize.define(
    "McpOAuthRefresh",
    {
      id: { type: D.STRING(64), primaryKey: true },
      grant_id: { type: D.UUID, allowNull: false },
      usedAt: D.DATE,
    },
    { freezeTableName: true }
  );
  Refresh.associate = (db) =>
    Refresh.belongsTo(db.McpOAuthGrant, { foreignKey: "grant_id", onDelete: "CASCADE" });
  return Refresh;
};
