module.exports = {
  up: async (queryInterface) => {
    return queryInterface.removeColumn("DataRequest", "chart_id")
      .catch(() => Promise.resolve("done"));
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("DataRequest", "chart_id")
      .catch(() => Promise.resolve("done"));
  }
};
