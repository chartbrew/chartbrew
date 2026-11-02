module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex("SourceExecution", ["finishedAt"], { name: "source_execution_finished" });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("SourceExecution", "source_execution_finished");
  },
};
