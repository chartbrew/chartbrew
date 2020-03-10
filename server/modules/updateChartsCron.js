const { CronJob } = require("cron");
const moment = require("moment");
const { Op } = require("sequelize");

const ChartController = require("../controllers/ChartController");

function updateCharts() {
  const chartController = new ChartController();

  const conditions = {
    where: {
      autoUpdate: { [Op.gt]: 0 }
    }
  };

  return chartController.findAll(conditions)
    .then((charts) => {
      const promises = [];
      if (!charts || charts.length === 0) {
        return new Promise(resolve => resolve({ completed: true }));
      }

      for (const chart of charts) {
        if (moment(chart.lastAutoUpdate).add(chart.autoUpdate, "seconds").isBefore(moment())) {
          promises.push(chartController.updateChartData(chart.id));
          promises.push(chartController.update(chart.id, { lastAutoUpdate: moment() }));
        }
      }

      if (promises.length === 0) return new Promise(resolve => resolve({ completed: true }));

      return Promise.all(promises);
    })
    .catch((error) => {
      return new Promise((resolve, reject) => reject(error));
    });
}

module.exports = () => {
  // run once initially to cover for server downtime
  updateCharts();

  // now run the cron job
  const cron = new CronJob("0 */1 * * * *", () => {
    updateCharts();
  });

  cron.start();

  return cron;
};
