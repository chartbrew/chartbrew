const Sequelize = require("sequelize");

const { encrypt, decrypt } = require("../../modules/cbCrypto");

const sshEncryptedFields = [
  "sshHost",
  "sshUsername",
  "sshPassword",
  "sshPrivateKey",
  "sshPassphrase",
  "sshJumpHost",
];

function quoteTable(queryInterface, tableName) {
  return queryInterface.queryGenerator?.quoteTable
    ? queryInterface.queryGenerator.quoteTable(tableName)
    : `\`${tableName}\``;
}

function quoteIdentifier(queryInterface, identifier) {
  return queryInterface.queryGenerator?.quoteIdentifier
    ? queryInterface.queryGenerator.quoteIdentifier(identifier)
    : `\`${identifier}\``;
}

function canDecrypt(value) {
  try {
    decrypt(value);
    return true;
  } catch (e) {
    return false;
  }
}

async function encryptExistingSshFields(queryInterface) {
  const tableName = quoteTable(queryInterface, "Connection");
  const quotedId = quoteIdentifier(queryInterface, "id");
  const quotedFields = sshEncryptedFields.map((field) => quoteIdentifier(queryInterface, field));
  const nonEmptyConditions = quotedFields
    .map((field) => `(${field} IS NOT NULL AND ${field} != '')`)
    .join(" OR ");

  const records = await queryInterface.sequelize.query(
    `SELECT ${quotedId}, ${quotedFields.join(", ")} FROM ${tableName} WHERE ${nonEmptyConditions}`,
    { type: Sequelize.QueryTypes.SELECT }
  );

  for (const record of records) {
    const updates = {};

    sshEncryptedFields.forEach((field) => {
      if (record[field] && !canDecrypt(record[field])) {
        updates[field] = encrypt(record[field]);
      }
    });

    if (Object.keys(updates).length > 0) {
      const setClause = Object.keys(updates)
        .map((field) => `${quoteIdentifier(queryInterface, field)} = :${field}`)
        .join(", ");

      // oxlint-disable-next-line no-await-in-loop
      await queryInterface.sequelize.query(
        `UPDATE ${tableName} SET ${setClause} WHERE ${quotedId} = :id`,
        {
          replacements: { ...updates, id: record.id },
          type: Sequelize.QueryTypes.UPDATE,
        }
      );
    }
  }
}

module.exports = {
  async up(queryInterface) {
    for (const field of sshEncryptedFields) {
      // oxlint-disable-next-line no-await-in-loop
      await queryInterface.changeColumn("Connection", field, {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    await encryptExistingSshFields(queryInterface);
  },

  async down(queryInterface) {
    for (const field of sshEncryptedFields) {
      // oxlint-disable-next-line no-await-in-loop
      await queryInterface.changeColumn("Connection", field, {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },
};
