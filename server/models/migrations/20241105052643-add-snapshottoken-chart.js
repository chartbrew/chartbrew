const Sequelize = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Chart", "snapshotToken", {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
    });

    // update all existing charts with both mysql and postgres queries
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "mysql") {
      await queryInterface.sequelize.query(`
        UPDATE Chart SET snapshotToken = UUID() WHERE snapshotToken IS NULL;
      `);
    } else if (dialect === "postgres") {
      await queryInterface.sequelize.query(`
        UPDATE "Chart" SET "snapshotToken" = gen_random_uuid() WHERE "snapshotToken" IS NULL;
      `);
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Chart", "snapshotToken");
  }
};
