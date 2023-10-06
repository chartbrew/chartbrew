const db = require("../models");

function throttlePromises(promises, chunkSize, index) {
  if (index >= promises.length) return Promise.resolve();

  const promisesChunk = promises.slice(index, index + chunkSize);

  return Promise.all(promisesChunk)
    .then(() => throttlePromises(promises, chunkSize, index + chunkSize))
    .catch(() => throttlePromises(promises, chunkSize, index + chunkSize));
}

module.exports.up = async () => {
  const projects = await db.Project.findAll({
    attributes: ["id", "team_id"],
  });

  const updatePromises = [];
  projects.forEach((project) => {
    updatePromises.push(
      db.Connection.update(
        { team_id: project.team_id, project_ids: [project.id] },
        { where: { project_id: project.id } },
      ),
    );
  });

  return throttlePromises(updatePromises, 5, 0);
};

module.exports.down = async () => {
  // no need to do anything here because the columns will be dropped
};
