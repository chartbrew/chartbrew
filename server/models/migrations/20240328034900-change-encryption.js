const Sequelize = require("sequelize");
const simplecrypt = require("simplecrypt");

const { encrypt } = require("../../modules/cbCrypto");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

async function migrateEncryptedFields(queryInterface, tableName, fields, noEncryption = false) {
  const dialect = queryInterface.sequelize.getDialect();
  const quotedTableName = dialect === "postgres" ? `"${tableName}"` : `\`${tableName}\``;

  // Fetch all records from the table
  const records = await queryInterface.sequelize.query(
    `SELECT * FROM ${quotedTableName};`,
    { type: Sequelize.QueryTypes.SELECT }
  );

  for (const record of records) {
    const updates = {};
    let needsUpdate = false;

    // Process each field to be encrypted
    for (const field of fields) {
      let decryptedValue;
      try {
        // Attempt to decrypt with the old algorithm
        decryptedValue = sc.decrypt(record[field]);
      } catch (e) {
        // If decryption fails, assume it's in the new format or plaintext
        decryptedValue = record[field];
      }

      // Encrypt with the new algorithm
      const encryptedValue = noEncryption || !decryptedValue
        ? decryptedValue : encrypt(decryptedValue);

      // Check if encryption changed the value, indicating an update is needed
      if (encryptedValue !== record[field]) {
        updates[field] = encryptedValue;
        needsUpdate = true;
      }
    }

    // Update the record if any field values changed
    if (needsUpdate) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.sequelize.query(
        `UPDATE ${quotedTableName} SET ${Object.keys(updates).map((key) => `${key} = :${key}`).join(", ")} WHERE id = :id`,
        {
          replacements: { ...updates, id: record.id },
          type: Sequelize.QueryTypes.UPDATE
        }
      );
    }
  }
}

module.exports = {
  async up(queryInterface) {
    // migrate ApiKey - token
    await migrateEncryptedFields(queryInterface, "ApiKey", ["token"]);

    // migrate Connection
    // - host, dbName, port, username, password, options, connectionString,
    // - authentification, firebaseServiceAccount

    await migrateEncryptedFields(
      queryInterface,
      "Connection",
      ["host", "dbName", "port", "username", "password", "options", "connectionString", "authentification", "firebaseServiceAccount"],
    );

    // migrate DataRequest
    // - headers, body, variables
    await migrateEncryptedFields(queryInterface, "DataRequest", ["headers", "body", "variables"]);

    // migrate Dataset
    // - fieldsSchema
    await migrateEncryptedFields(queryInterface, "Dataset", ["fieldsSchema"]);

    // migrate OAuth
    // - refreshToken
    await migrateEncryptedFields(queryInterface, "OAuth", ["refreshToken"]);

    // migrate TeamInvitation
    // - email
    await migrateEncryptedFields(queryInterface, "TeamInvitation", ["email"]);

    // migrate Template
    // - model
    await migrateEncryptedFields(queryInterface, "Template", ["model"]);

    // migrate User
    // - email
    await migrateEncryptedFields(queryInterface, "User", ["email"], true);
  },

  async down() {
    // No need to decrypt the fields back since the old encryption method is still available
  }
};
