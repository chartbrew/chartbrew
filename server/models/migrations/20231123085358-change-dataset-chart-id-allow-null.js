const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();

    let charts;
    if (dialect === "mysql") {
      charts = await queryInterface.sequelize.query(`
        SELECT id FROM Chart LIMIT 1;
      `, { type: Sequelize.QueryTypes.SELECT });
    } else if (dialect === "postgres") {
      charts = await queryInterface.sequelize.query(`
          SELECT id FROM "Chart" LIMIT 1;
        `, { type: Sequelize.QueryTypes.SELECT });
    }

    let datasetsWithTempChart = [];
    let tempChartId;
    if (charts.length > 0) {
      tempChartId = charts[0].id;

      if (dialect === "mysql") {
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
      } else if (dialect === "postgres") {
        datasetsWithTempChart = await queryInterface.sequelize.query(
          `SELECT id FROM "Dataset" WHERE chart_id = ${tempChartId};`,
          { type: Sequelize.QueryTypes.SELECT }
        );

        await queryInterface.sequelize.query(`
          UPDATE "Dataset"
          LEFT JOIN "Chart" ON "Dataset".chart_id = "Chart".id
          SET "Dataset".chart_id = ${tempChartId}
          WHERE "Chart".id IS NULL;
        `);
      }
    }

    if (dialect === "mysql") {
      await queryInterface.sequelize.query(`
        ALTER TABLE Dataset MODIFY COLUMN chart_id INTEGER NULL DEFAULT NULL;
      `);
    } else if (dialect === "postgres") {
      await queryInterface.sequelize.query(`
        ALTER TABLE "Dataset" ALTER COLUMN chart_id DROP NOT NULL;
      `);
    }

    if (dialect === "postgres") {
      await queryInterface.sequelize.query(`
        ALTER TABLE "Dataset" DROP CONSTRAINT IF EXISTS "Dataset_chart_id_fkey";
      `);

      // Change the column without the references option
      await queryInterface.changeColumn("Dataset", "chart_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null
      });

      // Add the new foreign key constraint
      await queryInterface.sequelize.query(`
        ALTER TABLE "Dataset"
        ADD CONSTRAINT "Dataset_chart_id_fkey"
        FOREIGN KEY ("chart_id")
        REFERENCES "Chart"("id")
        ON DELETE SET NULL;
      `);
    } else {
      await queryInterface.changeColumn("Dataset", "chart_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        references: {
          model: "Chart",
          key: "id",
          onDelete: "SET NULL"
        }
      });
    }

    if (datasetsWithTempChart.length > 0) {
      if (dialect === "mysql") {
        await queryInterface.sequelize.query(`
          UPDATE Dataset
          LEFT JOIN Chart ON Dataset.chart_id = Chart.id
          SET Dataset.chart_id = NULL
          WHERE Chart.id = ${tempChartId}
          AND Dataset.id NOT IN (${datasetsWithTempChart.map((dataset) => dataset.id).join(",")});
        `);
      } else if (dialect === "postgres") {
        await queryInterface.sequelize.query(`
          UPDATE "Dataset"
          LEFT JOIN "Chart" ON "Dataset".chart_id = "Chart".id
          SET "Dataset".chart_id = NULL
          WHERE "Chart".id = ${tempChartId}
          AND "Dataset".id NOT IN (${datasetsWithTempChart.map((dataset) => dataset.id).join(",")});
        `);
      }
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
