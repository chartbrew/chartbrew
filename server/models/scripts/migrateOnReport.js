const db = require("../models");

module.exports.up = () => {
  return db.Chart.findAll({
    attributes: ["id", "public"],
  })
    .then((charts) => {
      const updatePromises = [];
      charts.forEach((chart) => {
        if (chart.public) {
          updatePromises.push(
            db.Chart.update({ onReport: true }, { where: { id: chart.id } }),
          );
        }
      });

      return Promise.all(updatePromises);
    });
};
