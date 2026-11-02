const db = require("../models/models");

async function migrate() {
  try {
    const migrations = await db.migrate();
    if (migrations.length > 0) {
      console.info(`Applied ${migrations.length} database migration${migrations.length === 1 ? "" : "s"}.`); // eslint-disable-line
    } else {
      console.info("Database schema is up to date."); // eslint-disable-line
    }
  } catch (error) {
    console.error(error); // eslint-disable-line
    process.exitCode = 1;
  } finally {
    await db.sequelize.close();
  }
}

migrate();
