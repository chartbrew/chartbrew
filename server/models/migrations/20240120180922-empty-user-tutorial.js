module.exports = {
  async up(queryInterface) {
    // empty the tutorials column for the user table
    await queryInterface.bulkUpdate("User", {
      tutorials: "{}"
    }, {});
  },

  async down() {
    // no rollback
  }
};
