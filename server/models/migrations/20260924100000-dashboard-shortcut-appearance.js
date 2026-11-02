const S = require("sequelize");

module.exports = {
  async up(q) {
    await q.addColumn("Project", "sidebarIcon", { type: S.STRING, allowNull: false, defaultValue: "grid" });
    await q.addColumn("Project", "sidebarColor", { type: S.STRING, allowNull: false, defaultValue: "blue" });
    await q.addColumn("Project", "sidebarDisplay", { type: S.STRING, allowNull: false, defaultValue: "icon" });
  },
  async down(q) {
    await q.removeColumn("Project", "sidebarDisplay");
    await q.removeColumn("Project", "sidebarColor");
    await q.removeColumn("Project", "sidebarIcon");
  },
};
