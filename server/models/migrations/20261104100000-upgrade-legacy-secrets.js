const { QueryTypes } = require("sequelize");
const CryptoJS = require("crypto-js");
require("../../modules/legacyCryptoCompat");
const simplecrypt = require("simplecrypt");
const { encrypt, decrypt } = require("../../modules/cbCrypto");

const fields = {
  Connection: ["host", "dbName", "port", "username", "password", "options", "connectionString", "authentication", "firebaseServiceAccount", "sshHost", "sshUsername", "sshPassword", "sshPrivateKey", "sshPassphrase", "sshJumpHost"],
  DataRequest: ["headers", "body", "variables"],
  Dataset: ["fieldsSchema"],
  DatasetIntelligence: ["profile", "overrides"],
  OAuth: ["refreshToken"],
  Apikey: ["token"],
  TeamInvitation: ["email"],
  Template: ["model"],
  User2fa: ["secret", "backup"],
};

module.exports = {
  async up(queryInterface) {
    const sc = simplecrypt({ password: process.env.CB_SECRET, salt: "10" });
    const generator = queryInterface.queryGenerator;
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const [table, columns] of Object.entries(fields)) {
        const selectedColumns = table === "User2fa" ? ["id", "isEnabled", ...columns] : ["id", ...columns];
        const selected = selectedColumns.map((column) => generator.quoteIdentifier(column)).join(", ");
        // oxlint-disable-next-line no-await-in-loop
        const rows = await queryInterface.sequelize.query(`SELECT ${selected} FROM ${generator.quoteTable(table)}`, {
          type: QueryTypes.SELECT, transaction,
        });
        for (const row of rows) {
          const updates = {};
          let discardSetup = false;
          columns.forEach((column) => {
            if (discardSetup) return;
            const value = row[column];
            if (!value) return;
            const isCurrent = /^[a-f0-9]{32}:[a-f0-9]+$/i.test(value);
            let plaintext;
            if (table === "User2fa") {
              try {
                plaintext = isCurrent
                  ? decrypt(value)
                  : CryptoJS.AES.decrypt(value, process.env.CB_SECRET).toString(CryptoJS.enc.Utf8);
                if (!plaintext) throw new Error("Empty two-factor data");
              } catch {
                if (row.isEnabled === false || row.isEnabled === 0) {
                  discardSetup = true;
                  return;
                }
                throw new Error("Cannot decrypt existing two-factor data. Check the original encryption keys and stored data before retrying.");
              }
              if (isCurrent) return;
            } else {
              if (isCurrent) {
                decrypt(value);
                return;
              }
              try {
                plaintext = sc.decrypt(value);
              } catch (error) {
                // Preserve plaintext values accepted by the existing model getters.
                if (/^[a-f0-9]+$/i.test(value) && value.length % 32 === 0) throw error;
                plaintext = value;
              }
            }
            updates[column] = encrypt(plaintext);
          });
          if (discardSetup) {
            // Remove only incomplete setups; never disable an active authentication method.
            // oxlint-disable-next-line no-await-in-loop
            await queryInterface.bulkDelete(table, { id: row.id, isEnabled: false }, { transaction });
          } else if (Object.keys(updates).length) {
            // oxlint-disable-next-line no-await-in-loop
            await queryInterface.bulkUpdate(table, updates, { id: row.id }, { transaction });
          }
        }
      }
    });
  },

  async down() {
    // Keep secrets encrypted with the current key when rolling back schema changes.
  },
};
