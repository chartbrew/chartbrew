/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("SharePolicy", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      entity_type: {
        type: Sequelize.ENUM("Project", "Chart"),
        allowNull: false,
      },
      entity_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      visibility: {
        type: Sequelize.ENUM("public", "private", "password", "disabled"),
        allowNull: false,
      },
      params: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      allow_params: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      password: {
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("SharePolicy");
  }
};
