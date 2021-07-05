const Sequelize = require("sequelize");

module.exports = {
  up: (queryInterface) => {
    return queryInterface.changeColumn("Chart", "draft", {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    });
  },

  down: (queryInterface) => {
    return queryInterface.changeColumn("Chart", "draft", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
  },
};
