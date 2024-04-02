const Sequelize = require("sequelize");
const simplecrypt = require("simplecrypt");

const { encrypt } = require("../../modules/cbCrypto");

const secret = process.env.NODE_ENV === "production" ? process.env.CB_SECRET : process.env.CB_SECRET_DEV;

const sc = simplecrypt({
  password: secret,
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
      if (record[field]) {
        try {
          // Attempt to decrypt with the old algorithm
          decryptedValue = sc.decrypt(record[field]);
        } catch (e) {
          // If decryption fails, assume it's in the new format or plaintext
          decryptedValue = record[field];
        }
      }

      // Encrypt with the new algorithm
      const encryptedValue = noEncryption || !decryptedValue
        ? decryptedValue : encrypt(decryptedValue);

      // Check if encryption changed the value, indicating an update is needed
      if (encryptedValue !== record[field] && encryptedValue) {
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
    // change column types
    await queryInterface.changeColumn("Connection", "password", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.changeColumn("Connection", "firebaseServiceAccount", {
      type: Sequelize.TEXT("long"),
      allowNull: true,
    });

    await queryInterface.changeColumn("Connection", "host", {
      type: Sequelize.TEXT("long"),
      allowNull: true,
    });

    await queryInterface.changeColumn("Connection", "dbName", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.changeColumn("Connection", "username", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.changeColumn("Connection", "port", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // migrate ApiKey - token
    await migrateEncryptedFields(queryInterface, "Apikey", ["token"]);

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

  async down(queryInterface) {
    await queryInterface.changeColumn("Connection", "password", {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.changeColumn("Connection", "firebaseServiceAccount", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.changeColumn("Connection", "host", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.changeColumn("Connection", "dbName", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.changeColumn("Connection", "username", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.changeColumn("Connection", "port", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // No need to decrypt the fields back since the old encryption method is still available
  }
};
