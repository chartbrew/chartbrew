const { nanoid } = require("nanoid");

function throttlePromises(promises, chunkSize, index) {
  if (index >= promises.length) return Promise.resolve();

  const promisesChunk = promises.slice(index, index + chunkSize);

  return Promise.all(promisesChunk)
    .then(() => throttlePromises(promises, chunkSize, index + chunkSize))
    .catch(() => throttlePromises(promises, chunkSize, index + chunkSize));
}

module.exports.up = async (queryInterface) => {
  const dialect = queryInterface.sequelize.getDialect();

  let teams;
  if (dialect === "mysql") {
    teams = await queryInterface.sequelize.query(
      "SELECT id FROM Team;",
    );
  } else if (dialect === "postgres") {
    teams = await queryInterface.sequelize.query(
      "SELECT id FROM \"Team\";",
    );
  }

  const teamRows = teams[0];
  const projectPromises = [];
  teamRows.forEach((team) => {
    const ghostProject = {
      team_id: team.id,
      name: "Ghost Project",
      brewName: `ghost-project-${nanoid(8)}`,
      dashboardTitle: "Ghost Project",
      description: "Ghost Project",
      public: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ghost: true,
    };

    projectPromises.push(queryInterface.bulkInsert("Project", [ghostProject]));
  });

  return throttlePromises(projectPromises, 5, 0);
};

module.exports.down = async (queryInterface) => {
  const dialect = queryInterface.sequelize.getDialect();

  if (dialect === "mysql") {
    await queryInterface.sequelize.query(
      "DELETE FROM Project WHERE ghost = true;",
    );
  } else if (dialect === "postgres") {
    await queryInterface.sequelize.query(
      "DELETE FROM \"Project\" WHERE ghost = true;",
    );
  }
};
