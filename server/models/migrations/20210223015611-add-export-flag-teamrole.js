const addExportPermission = require("../scripts/addExportPermission");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("TeamRole", "canExport", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });

    await addExportPermission.up();
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("TeamRole", "canExport");
  }
};
