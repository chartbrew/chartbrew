const Sequelize = require("sequelize");

function buildFilterSelectQuery(queryInterface) {
  const queryGenerator = queryInterface.queryGenerator
    || queryInterface.sequelize.getQueryInterface().queryGenerator;
  const table = queryGenerator.quoteTable("DashboardFilter");
  const id = queryGenerator.quoteIdentifier("id");
  const projectId = queryGenerator.quoteIdentifier("project_id");
  const createdAt = queryGenerator.quoteIdentifier("createdAt");

  return `SELECT ${id}, ${projectId} FROM ${table} ORDER BY ${projectId} ASC, ${createdAt} ASC, ${id} ASC`;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("DashboardFilter", "position", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    const filters = await queryInterface.sequelize.query(
      buildFilterSelectQuery(queryInterface),
      { type: Sequelize.QueryTypes.SELECT }
    );
    const positions = new Map();

    for (const filter of filters) {
      const position = positions.get(filter.project_id) || 0;
      // oxlint-disable-next-line no-await-in-loop
      await queryInterface.bulkUpdate(
        "DashboardFilter",
        { position },
        { id: filter.id }
      );
      positions.set(filter.project_id, position + 1);
    }

    await queryInterface.changeColumn("DashboardFilter", "position", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("DashboardFilter", "position");
  },
};
