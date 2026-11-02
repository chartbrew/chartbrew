module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Chart", "configurationVersion", {
      type: Sequelize.INTEGER, allowNull: false, defaultValue: 0,
    });
    await queryInterface.createTable("ChartVersion", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      chart_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "Chart", key: "id" }, onDelete: "CASCADE" },
      version: { type: Sequelize.INTEGER, allowNull: false },
      user_id: { type: Sequelize.INTEGER, references: { model: "User", key: "id" }, onDelete: "SET NULL" },
      origin: { type: Sequelize.STRING(16), allowNull: false },
      configuration: { type: Sequelize.TEXT("long"), allowNull: false },
      summary: { type: Sequelize.STRING, allowNull: false },
      restored_from_version: Sequelize.INTEGER,
      operation_id: Sequelize.STRING(128),
      createdAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("ChartVersion", ["chart_id", "version"], { unique: true });
    await queryInterface.addIndex("ChartVersion", ["chart_id", "operation_id"], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ChartVersion");
    await queryInterface.removeColumn("Chart", "configurationVersion");
  },
};
