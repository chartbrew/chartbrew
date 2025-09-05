/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("SharePolicy", "share_string", {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("SharePolicy", "share_string");
  }
};
