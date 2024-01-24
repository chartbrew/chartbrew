module.exports = {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "mysql") {
      await queryInterface.sequelize.query("UPDATE Chart SET mode = 'chart', type = 'kpi' WHERE mode = 'kpi'");
    } else if (dialect === "postgres") {
      await queryInterface.sequelize.query("UPDATE \"Chart\" SET mode = 'chart', type = 'kpi' WHERE mode = 'kpi'");
    }
  },

  async down(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "mysql") {
      await queryInterface.sequelize.query("UPDATE Chart SET mode = 'kpi', type = 'line' WHERE type = 'kpi'");
    } else if (dialect === "postgres") {
      await queryInterface.sequelize.query("UPDATE \"Chart\" SET mode = 'kpi', type = 'line' WHERE type = 'kpi'");
    }
  }
};
