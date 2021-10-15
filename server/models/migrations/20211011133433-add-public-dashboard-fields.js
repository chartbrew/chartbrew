const Sequelize = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("Project", "description", {
      type: Sequelize.TEXT,
    });
    await queryInterface.addColumn("Project", "backgroundColor", {
      type: Sequelize.STRING,
      defaultValue: "#103751",
    });
    await queryInterface.addColumn("Project", "titleColor", {
      type: Sequelize.STRING,
      defaultValue: "white",
    });
    await queryInterface.addColumn("Project", "headerCode", {
      type: Sequelize.TEXT,
    });
    await queryInterface.addColumn("Project", "footerCode", {
      type: Sequelize.TEXT,
    });
    await queryInterface.addColumn("Project", "logo", {
      type: Sequelize.STRING,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Project", "description");
    await queryInterface.removeColumn("Project", "backgroundColor");
    await queryInterface.removeColumn("Project", "titleColor");
    await queryInterface.removeColumn("Project", "headerCode");
    await queryInterface.removeColumn("Project", "footerCode");
    await queryInterface.removeColumn("Project", "logo");
  }
};
