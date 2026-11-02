const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const hasBusinessProfile = tables.some((table) => {
      const tableName = typeof table === "string" ? table : table.tableName || table.table_name;
      return tableName === "TeamBusinessProfile";
    });
    if (!hasBusinessProfile) return;
    const columns = await queryInterface.describeTable("TeamBusinessProfile");
    if (columns.aiContextAllowed) {
      await queryInterface.removeColumn("TeamBusinessProfile", "aiContextAllowed");
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("TeamBusinessProfile");
    if (!columns.aiContextAllowed) {
      await queryInterface.addColumn("TeamBusinessProfile", "aiContextAllowed", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },
};
