module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query("UPDATE Chart SET mode = \"chart\", type = \"kpi\" WHERE mode = \"kpi\"");
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query("UPDATE Chart SET mode = \"kpi\", type = \"line\" WHERE type = \"kpi\"");
  }
};
