const bcrypt = require("bcrypt");

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

module.exports = {
  up: async (queryInterface) => {
    const [projects] = await queryInterface.sequelize.query(
      "SELECT id, password FROM Project WHERE password IS NOT NULL AND password != ''"
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
