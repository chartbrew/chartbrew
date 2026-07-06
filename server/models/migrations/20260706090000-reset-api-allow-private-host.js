/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkUpdate(
      "Connection",
      { allowPrivateHost: null },
      { type: "api" }
    );
  },

  async down() {
    return Promise.resolve();
  },
};
