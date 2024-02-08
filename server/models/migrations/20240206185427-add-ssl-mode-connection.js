const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Connection", "ssl", {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });

    await queryInterface.addColumn("Connection", "sslMode", {
      type: Sequelize.STRING,
      defaultValue: "require"
    });

    await queryInterface.addColumn("Connection", "sslCa", {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn("Connection", "sslCert", {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn("Connection", "sslKey", {
      type: Sequelize.STRING,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Connection", "ssl");
    await queryInterface.removeColumn("Connection", "sslMode");
    await queryInterface.removeColumn("Connection", "sslCa");
    await queryInterface.removeColumn("Connection", "sslCert");
    await queryInterface.removeColumn("Connection", "sslKey");
  }
};
