const Sequelize = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Connection", "useSsh", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
    await queryInterface.addColumn("Connection", "sshHost", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("Connection", "sshPort", {
      type: Sequelize.INTEGER,
    });
    await queryInterface.addColumn("Connection", "sshUsername", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("Connection", "sshPassword", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("Connection", "sshPrivateKey", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("Connection", "sshPassphrase", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("Connection", "sshJumpHost", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("Connection", "sshJumpPort", {
      type: Sequelize.INTEGER,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Connection", "useSsh");
    await queryInterface.removeColumn("Connection", "sshHost");
    await queryInterface.removeColumn("Connection", "sshPort");
    await queryInterface.removeColumn("Connection", "sshUsername");
    await queryInterface.removeColumn("Connection", "sshPassword");
    await queryInterface.removeColumn("Connection", "sshPrivateKey");
    await queryInterface.removeColumn("Connection", "sshPassphrase");
    await queryInterface.removeColumn("Connection", "sshJumpHost");
    await queryInterface.removeColumn("Connection", "sshJumpPort");
  },
};
