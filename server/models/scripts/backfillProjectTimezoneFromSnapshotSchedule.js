function isBlank(value) {
  return value === null || value === undefined || value === "";
}

function throttlePromises(promises, chunkSize, index) {
  if (index >= promises.length) return Promise.resolve();

  const promisesChunk = promises.slice(index, index + chunkSize);

  return Promise.all(promisesChunk)
    .then(() => throttlePromises(promises, chunkSize, index + chunkSize))
    .catch(() => throttlePromises(promises, chunkSize, index + chunkSize));
}

function buildSelectQuery(queryInterface, tableName, columns) {
  const queryGenerator = queryInterface.queryGenerator
    || queryInterface.sequelize.getQueryInterface().queryGenerator;
  const quotedTable = queryGenerator.quoteTable(tableName);
  const quotedColumns = columns.map((column) => {
    const quotedColumn = queryGenerator.quoteIdentifier(column);
    return `${quotedColumn} AS ${quotedColumn}`;
  });

  return `SELECT ${quotedColumns.join(", ")} FROM ${quotedTable}`;
}

module.exports.up = async (queryInterface) => {
  const projects = await queryInterface.sequelize.query(
    buildSelectQuery(queryInterface, "Project", ["id", "timezone", "updateSchedule", "snapshotSchedule"]),
    { type: queryInterface.sequelize.QueryTypes.SELECT }
  );

  const updatePromises = [];

  projects.forEach((project) => {
    if (!isBlank(project.timezone)) {
      return;
    }

    let snapshotSchedule;
    try {
      snapshotSchedule = JSON.parse(project.snapshotSchedule);
    } catch (error) {
      return;
    }

    let updateSchedule;
    try {
      updateSchedule = JSON.parse(project.updateSchedule);
    } catch (error) {
      updateSchedule = null;
    }

    const snapshotTimezone = snapshotSchedule && typeof snapshotSchedule === "object" && !Array.isArray(snapshotSchedule)
      ? snapshotSchedule.timezone
      : null;
    const updateTimezone = updateSchedule && typeof updateSchedule === "object" && !Array.isArray(updateSchedule)
      ? updateSchedule.timezone
      : null;
    const timezone = snapshotTimezone || updateTimezone;

    if (isBlank(timezone)) {
      return;
    }

    updatePromises.push(
      queryInterface.bulkUpdate(
        "Project",
        { timezone },
        { id: project.id }
      )
    );
  });

  return throttlePromises(updatePromises, 20, 0);
};

module.exports.down = async () => {
  // no-op; copied values cannot be safely reverted
};
