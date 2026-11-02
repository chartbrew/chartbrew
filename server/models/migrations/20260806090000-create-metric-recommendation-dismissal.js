const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("MetricRecommendationDismissal", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      team_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Team", key: "id" },
        onDelete: "CASCADE",
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Project", key: "id" },
        onDelete: "CASCADE",
      },
      chart_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Chart", key: "id" },
        onDelete: "CASCADE",
      },
      dismissed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "User", key: "id" },
        onDelete: "SET NULL",
      },
      binding_key: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      definition_fingerprint: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      dismissal_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      expires_at: Sequelize.DATE,
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
    await queryInterface.addIndex(
      "MetricRecommendationDismissal",
      ["team_id", "chart_id", "binding_key"],
      {
        name: "metric_recommendation_dismissal_unique",
        unique: true,
      }
    );
    await queryInterface.addIndex(
      "MetricRecommendationDismissal",
      ["team_id", "expires_at"],
      { name: "metric_recommendation_dismissal_expiry" }
    );
  },
};
