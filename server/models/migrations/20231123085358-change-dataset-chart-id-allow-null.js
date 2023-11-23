const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    const charts = await queryInterface.sequelize.query(
      "SELECT id FROM Chart LIMIT 1;",
      { type: Sequelize.QueryTypes.SELECT }
    );

    let datasetsWithTempChart = [];
    let tempChartId;
    if (charts.length > 0) {
      tempChartId = charts[0].id;

      datasetsWithTempChart = await queryInterface.sequelize.query(
        `SELECT id FROM Dataset WHERE chart_id = ${tempChartId};`,
        { type: Sequelize.QueryTypes.SELECT }
      );

      await queryInterface.sequelize.query(`
        UPDATE Dataset
        LEFT JOIN Chart ON Dataset.chart_id = Chart.id
        SET Dataset.chart_id = ${tempChartId}
        WHERE Chart.id IS NULL;
      `);
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE Dataset
      MODIFY COLUMN chart_id INTEGER NULL DEFAULT NULL;
    `);

    await queryInterface.changeColumn("Dataset", "chart_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      references: {
        model: "Chart",
        key: "id",
        onDelete: "SET NULL"
      },
    });

    if (datasetsWithTempChart.length > 0) {
      await queryInterface.sequelize.query(`
        UPDATE Dataset
        LEFT JOIN Chart ON Dataset.chart_id = Chart.id
        SET Dataset.chart_id = NULL
        WHERE Chart.id = ${tempChartId}
        AND Dataset.id NOT IN (${datasetsWithTempChart.map((dataset) => dataset.id).join(",")});
      `);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("Dataset", "chart_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "Chart",
        key: "id",
        onDelete: "cascade",
      },
    });
  }
};
