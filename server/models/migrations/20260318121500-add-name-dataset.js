module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Dataset", "name", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === "mysql") {
      await queryInterface.sequelize.query(`
        UPDATE Dataset
        SET name = legend
        WHERE name IS NULL AND legend IS NOT NULL
      `);
    } else if (dialect === "postgres") {
      await queryInterface.sequelize.query(`
        UPDATE "Dataset"
        SET "name" = "legend"
        WHERE "name" IS NULL AND "legend" IS NOT NULL
      `);
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Dataset", "name");
  },
};
