const moment = require("moment");
const cron = require("node-cron");

const db = require("../models/models");

function clean() {
  return db.Chart.findAll({
    include: [{
      model: db.Project,
      where: { ghost: true },
      required: true,
    }]
  })
    .then((charts) => {
      if (charts.length === 0) return [];
      const cleanPromises = [];
      charts.forEach((chart) => {
        const timeDiff = moment().diff(chart.createdAt, "hours");

        if (timeDiff > 24) {
          // clean the data field in each cache item
          cleanPromises.push(db.Chart.destroy({ where: { id: chart.id } }));
        }
      });

      if (cleanPromises.length > 0) return Promise.all(cleanPromises);

      return [];
    })
    .catch(() => {
      // do nothing
    });
}

module.exports = () => {
  // now run the cron job every day at midnight
  cron.schedule("0 0 * * *", () => {
    clean();
  });

  return true;
};
