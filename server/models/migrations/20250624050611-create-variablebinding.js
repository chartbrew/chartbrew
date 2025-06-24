/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("VariableBinding", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      entity_type: {
        type: Sequelize.ENUM("Project", "Connection", "Dataset", "DataRequest", "Template"),
        allowNull: false,
      },
      entity_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM("string", "number", "boolean", "date"),
        allowNull: false,
      },
      default_value: {
        type: Sequelize.TEXT,
      },
      required: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      createdAt: {
        type: Sequelize.DATE,
      },
      updatedAt: {
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("VariableBinding", ["entity_type", "entity_id", "name"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("VariableBinding");
  }
};
