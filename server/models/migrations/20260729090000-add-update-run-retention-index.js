module.exports = {
  async up(queryInterface) {
    const indexes = await queryInterface.showIndex("UpdateRun");
    if (!indexes.some((index) => index.name === "update_run_started_at_idx")) {
      await queryInterface.addIndex("UpdateRun", ["startedAt"], {
        name: "update_run_started_at_idx",
      });
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex("UpdateRun");
    if (indexes.some((index) => index.name === "update_run_started_at_idx")) {
      await queryInterface.removeIndex("UpdateRun", "update_run_started_at_idx");
    }
  },
};
