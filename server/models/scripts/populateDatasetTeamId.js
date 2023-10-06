const db = require("../models");

function throttlePromises(promises, chunkSize, index) {
  if (index >= promises.length) return Promise.resolve();

  const promisesChunk = promises.slice(index, index + chunkSize);

  return Promise.all(promisesChunk)
    .then(() => throttlePromises(promises, chunkSize, index + chunkSize))
    .catch(() => throttlePromises(promises, chunkSize, index + chunkSize));
}

module.exports.up = async () => {
  const charts = await db.Chart.findAll({
    attributes: ["id"],
    include: [{ model: db.Project, attributes: ["id", "team_id"] }],
  });

  const updatePromises = [];
  charts.forEach((chart) => {
    if (chart?.Project?.team_id) {
      updatePromises.push(
        db.Dataset.update(
          { team_id: chart?.Project?.team_id, project_ids: [chart.Project.id] },
          { where: { chart_id: chart.id } },
        ),
      );
    }
  });

  return throttlePromises(updatePromises, 5, 0);
};

module.exports.down = async () => {
  // no need to do anything here because the columns will be dropped
};
