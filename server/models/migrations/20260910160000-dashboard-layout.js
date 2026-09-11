const S = require("sequelize");

module.exports = {
  async up(q) {
    await q.addColumn("Project", "layoutOrder", { type: S.JSON, allowNull: true });
    await q.addColumn("Project", "layoutCustom", { type: S.JSON, allowNull: true });
    await q.addColumn("Project", "layoutRevision", { type: S.INTEGER, allowNull: false, defaultValue: 0 });
  },
  async down(q) {
    await q.removeColumn("Project", "layoutRevision");
    await q.removeColumn("Project", "layoutCustom");
    await q.removeColumn("Project", "layoutOrder");
  },
};
