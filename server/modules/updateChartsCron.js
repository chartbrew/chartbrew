const { CronJob } = require("cron");
const moment = require("moment");
const { Op } = require("sequelize");

const ChartController = require("../controllers/ChartController");

const chartController = new ChartController();

function runUpdate(chart) {
  return chartController.updateChartData(chart.id, null, {})
    .then(() => {
      return true;
    })
    .catch(() => {
      return true;
    });
}

function updateDate(chart) {
  if (moment(chart.lastAutoUpdate).add(chart.autoUpdate, "seconds").isBefore(moment())) {
    return chartController.update(chart.id, { lastAutoUpdate: moment() })
      .then(() => {
        return true;
      })
      .catch(() => {
        return true;
      });
  }

  return true;
}

async function throttleUpdates(updates, index, steps = 20) {
  if (index >= updates.length) {
    return "done";
  }

  // select the next 20 updates
  const nextUpdates = updates.slice(index, index + steps);
  const updatePromises = nextUpdates.map((update) => runUpdate(update));

  const result = await Promise.all(updatePromises); // eslint-disable-line

  return throttleUpdates(updates, index + steps);
}

async function throttleUpdateDates(updates, index, steps = 20) {
  if (index >= updates.length) {
    return "done";
  }

  // select the next 20 updates
  const nextUpdates = updates.slice(index, index + steps);
  const updatePromises = nextUpdates.map((update) => updateDate(update));

  const result = await Promise.all(updatePromises); // eslint-disable-line

  return throttleUpdateDates(updates, index + steps);
}

function updateCharts() {
  const conditions = {
    where: {
      autoUpdate: { [Op.gt]: 0 }
    },
    attributes: ["id", "lastAutoUpdate", "autoUpdate"],
  };

  return chartController.findAll(conditions)
    .then((charts) => {
      if (!charts || charts.length === 0) {
        return new Promise((resolve) => resolve({ completed: true }));
      }

      const filteredCharts = charts.filter((chart) => moment(chart.lastAutoUpdate).add(chart.autoUpdate, "seconds").isBefore(moment()));

      throttleUpdateDates(filteredCharts, 0);
      throttleUpdates(filteredCharts, 0);

      return { completed: true };
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
