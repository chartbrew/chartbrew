const db = require("../models");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up() {
    const charts = await db.Chart.findAll({
      attributes: ["id", "layout"],
    });

    const updates = charts
      .filter((chart) => chart.layout && chart.layout.lg)
      .map((chart) => {
        const { layout } = chart;
        layout.xl = [...layout.lg];
        layout.xxl = [...layout.lg];
        layout.xxxl = [...layout.lg];

        return db.Chart.update(
          { layout },
          { where: { id: chart.id } }
        );
      });

    await Promise.all(updates);
  },

  async down() {
    const charts = await db.Chart.findAll({
      attributes: ["id", "layout"]
    });

    const updates = charts
      .filter((chart) => chart.layout)
      .map((chart) => {
        const { layout } = chart;
        delete layout.xl;
        delete layout.xxl;
        delete layout.xxxl;

        return db.Chart.update(
          { layout },
          { where: { id: chart.id } }
        );
      });

    await Promise.all(updates);
  }
};
