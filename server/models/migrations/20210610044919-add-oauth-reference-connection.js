module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Connection", "oauth_id", {
      type: Sequelize.UUID,
      allowNull: true,
      reference: {
        model: "OAuth",
        key: "id",
        onDelete: "cascade",
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Connection", "oauth_id");
  }
};
