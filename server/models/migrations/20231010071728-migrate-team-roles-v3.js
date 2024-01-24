const Sequelize = require("sequelize");
const migrateTeamRolesToV3 = require("../scripts/migrateTeamRolesToV3");

module.exports = {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();

    await queryInterface.addColumn("TeamRole", "role_backup", {
      type: Sequelize.STRING,
    });

    if (dialect === "mysql") {
      await queryInterface.sequelize.query(`
        UPDATE TeamRole SET role_backup = role
      `);
    } else if (dialect === "postgres") {
      await queryInterface.sequelize.query(`
        UPDATE "TeamRole" SET "role_backup" = "role"
      `);
    }

    await migrateTeamRolesToV3.up();
  },

  async down(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === "mysql") {
      await queryInterface.sequelize.query(`
        UPDATE TeamRole SET role = role_backup
      `);
    } else if (dialect === "postgres") {
      await queryInterface.sequelize.query(`
        UPDATE "TeamRole" SET "role" = "role_backup"
      `);
    }

    await queryInterface.removeColumn("TeamRole", "role_backup");
  }
};
