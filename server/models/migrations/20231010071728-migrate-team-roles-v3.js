const Sequelize = require("sequelize");
const migrateTeamRolesToV3 = require("../scripts/migrateTeamRolesToV3");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("TeamRole", "role_backup", {
      type: Sequelize.STRING,
    });

    await queryInterface.sequelize.query(
      "UPDATE `TeamRole` SET `role_backup` = `role`"
    );

    await migrateTeamRolesToV3.up();
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "UPDATE `TeamRole` SET `role` = `role_backup`"
    );

    await queryInterface.removeColumn("TeamRole", "role_backup");
  }
};
