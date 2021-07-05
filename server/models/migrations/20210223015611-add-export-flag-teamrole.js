const Sequelize = require("sequelize");

const addExportPermission = require("../scripts/addExportPermission");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("TeamRole", "canExport", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      set(val) {
        return this.setDataValue("canExport", val);
      }
    });

    await queryInterface.addColumn("TeamInvitation", "canExport", {
      type: Sequelize.BOOLEAN,
    });

    await addExportPermission.up();
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("TeamRole", "canExport");
    await queryInterface.removeColumn("TeamInvitation", "canExport");
  }
};
