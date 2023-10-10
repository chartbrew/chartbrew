const db = require("../models");

function throttlePromises(promises, chunkSize, index) {
  if (index >= promises.length) return Promise.resolve();

  const promisesChunk = promises.slice(index, index + chunkSize);

  return Promise.all(promisesChunk)
    .then(() => throttlePromises(promises, chunkSize, index + chunkSize))
    .catch(() => throttlePromises(promises, chunkSize, index + chunkSize));
}

module.exports.up = async () => {
  const teamRoles = await db.TeamRole.findAll();

  const updatePromises = [];
  teamRoles.forEach((tr) => {
    if (tr.role === "owner") {
      updatePromises.push(
        db.TeamRole.update(
          { role: "teamOwner" },
          { where: { id: tr.id } },
        ),
      );
    }

    if (tr.role === "admin") {
      updatePromises.push(
        db.TeamRole.update(
          { role: "projectAdmin" },
          { where: { id: tr.id } },
        ),
      );
    }

    if (tr.role === "editor") {
      updatePromises.push(
        db.TeamRole.update(
          { role: "projectAdmin" },
          { where: { id: tr.id } },
        ),
      );
    }

    if (tr.role === "member") {
      updatePromises.push(
        db.TeamRole.update(
          { role: "projectViewer" },
          { where: { id: tr.id } },
        ),
      );
    }
  });

  return throttlePromises(updatePromises, 5, 0);
};

module.exports.down = async () => {
  // no need to do anything because this is handled in the main migration script
};
