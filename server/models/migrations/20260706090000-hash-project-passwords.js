const bcrypt = require("bcrypt");

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

function buildSelectQuery(queryInterface) {
  const queryGenerator = queryInterface.queryGenerator
    || queryInterface.sequelize.getQueryInterface().queryGenerator;
  const quotedTable = queryGenerator.quoteTable("Project");
  const idColumn = queryGenerator.quoteIdentifier("id");
  const passwordColumn = queryGenerator.quoteIdentifier("password");

  return `SELECT ${idColumn} AS ${idColumn}, ${passwordColumn} AS ${passwordColumn} FROM ${quotedTable} WHERE ${passwordColumn} IS NOT NULL AND ${passwordColumn} != ''`;
}

module.exports = {
  up: async (queryInterface) => {
    const [projects] = await queryInterface.sequelize.query(
      buildSelectQuery(queryInterface)
    );

    await Promise.all(projects.map(async (project) => {
      const password = `${project.password}`;
      if (BCRYPT_HASH_PATTERN.test(password)) return;

      const hashedPassword = await bcrypt.hash(password, 12);
      await queryInterface.bulkUpdate(
        "Project",
        { password: hashedPassword },
        { id: project.id }
      );
    }));
  },

  down: async () => {
    // Password hashes cannot be converted back to plaintext.
  },
};
