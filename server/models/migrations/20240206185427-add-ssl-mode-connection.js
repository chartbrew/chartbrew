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

    await queryInterface.addColumn("Connection", "sslRootCert", {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn("Connection", "sslClientCert", {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn("Connection", "sslClientKey", {
      type: Sequelize.STRING,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Connection", "ssl");
    await queryInterface.removeColumn("Connection", "sslMode");
    await queryInterface.removeColumn("Connection", "sslRootCert");
    await queryInterface.removeColumn("Connection", "sslClientCert");
    await queryInterface.removeColumn("Connection", "sslClientKey");
  }
};
