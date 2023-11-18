const Sequelize = require("sequelize");

const createGhostProjects = require("../scripts/createGhostProjects");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Project", "ghost", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });

    await createGhostProjects.up(queryInterface);
  },

  async down(queryInterface) {
    await createGhostProjects.down(queryInterface);
    await queryInterface.removeColumn("Project", "ghost");
  }
};
