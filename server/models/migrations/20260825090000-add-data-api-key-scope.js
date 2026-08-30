const Sequelize = require("sequelize");

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable("Apikey");

    if (!columns.user_id) {
      await queryInterface.addColumn("Apikey", "user_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!columns.scopes) {
      await queryInterface.addColumn("Apikey", "scopes", {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      });
    }
    await queryInterface.bulkUpdate("Apikey", { scopes: "[]" }, { scopes: null });
    await queryInterface.changeColumn("Apikey", "scopes", {
      type: Sequelize.TEXT("long"),
      allowNull: false,
    });

    if (!columns.project_ids) {
      await queryInterface.addColumn("Apikey", "project_ids", {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      });
    }

    if (!columns.all_projects) {
      await queryInterface.addColumn("Apikey", "all_projects", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!columns.last_used_at) {
      await queryInterface.addColumn("Apikey", "last_used_at", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("Apikey");

    const removableColumns = ["last_used_at", "all_projects", "project_ids", "scopes", "user_id"]
      .filter((column) => columns[column]);
    for (const column of removableColumns) {
      // oxlint-disable-next-line no-await-in-loop -- table changes must run in order.
      await queryInterface.removeColumn("Apikey", column);
    }
  },
};
