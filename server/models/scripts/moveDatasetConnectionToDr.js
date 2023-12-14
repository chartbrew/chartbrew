// This script moves the Connection relationship from Dataset to DataRequest
const db = require("../models");

function throttlePromises(promises, chunkSize, index) {
  if (index >= promises.length) return Promise.resolve();

  const promisesChunk = promises.slice(index, index + chunkSize);

  return Promise.all(promisesChunk)
    .then(() => throttlePromises(promises, chunkSize, index + chunkSize))
    .catch(() => throttlePromises(promises, chunkSize, index + chunkSize));
}

module.exports.up = () => {
  return db.Dataset.findAll({
    attributes: ["id"],
    include: [
      { model: db.DataRequest, attributes: ["id"] },
    ],
  })
    .then((datasets) => {
      const updatePromises = [];
      datasets.forEach((dataset) => {
        if (dataset.connection_id) {
          dataset.DataRequests.forEach((dataRequest) => {
            updatePromises.push(
              db.DataRequest.update(
                { connection_id: dataset.connection_id }, { where: { id: dataRequest.id } },
              )
            );
          });
        }
      });

      return throttlePromises(updatePromises, 5, 0);
    });
};
