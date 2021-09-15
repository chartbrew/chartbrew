const uuid = require("uuid/v4");

const db = require("../models");

module.exports.up = () => {
  const creationPromises = [];
  db.Chart.findAll()
    .then((charts) => {
      charts.forEach((c) => {
        creationPromises.push(
          db.Chartshare.create({
            chart_id: c.id,
            shareString: uuid(),
          })
        );
      });

      Promise.all(creationPromises);
    })
    .then((data) => {
      return data;
    })
    .catch((err) => {
      return Promise.reject(err);
    });
};
