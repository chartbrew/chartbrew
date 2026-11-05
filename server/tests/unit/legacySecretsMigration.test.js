import { afterEach, describe, expect, it, vi } from "vitest";

const { Sequelize, DataTypes } = require("sequelize");
const CryptoJS = require("crypto-js");
require("../../modules/legacyCryptoCompat");
const simplecrypt = require("simplecrypt");
const { encrypt, decrypt } = require("../../modules/cbCrypto");
const migration = require("../../models/migrations/20261104100000-upgrade-legacy-secrets");
const settings = require("../../settings");

afterEach(() => vi.unstubAllEnvs());

describe("legacy secret migration", () => {
  it("writes two-factor secrets with the current key and still reads old records", async () => {
    const sequelize = new Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false });
    try {
      const User2fa = require("../../models/models/user2fa")(sequelize, DataTypes);
      const record = User2fa.build({ user_id: 1, method: "totp", secret: "JBSWY3DPEHPK3PXP", backup: "backup-codes" });
      expect(decrypt(record.getDataValue("secret"))).toBe(record.secret);
      expect(decrypt(record.getDataValue("backup"))).toBe(record.backup);
      record.setDataValue("secret", CryptoJS.AES.encrypt("old-seed", settings.secret).toString());
      expect(record.secret).toBe("old-seed");
      record.setDataValue("backup", null);
      expect(record.backup).toBeNull();
    } finally {
      await sequelize.close();
    }
  });

  it("migrates old secrets once and preserves current ciphertext", async () => {
    vi.stubEnv("CB_SECRET", "change_to_random_string");
    const sc = simplecrypt({ password: process.env.CB_SECRET, salt: "10" });
    const existing = encrypt("current-password");
    const rows = {
      Connection: [{ id: 1, password: sc.encrypt("old-password"), sshPrivateKey: sc.encrypt("old-key"), host: existing }],
      OAuth: [{ id: 2, refreshToken: sc.encrypt("old-token") }],
      User2fa: [{ id: "3", secret: CryptoJS.AES.encrypt("old-seed", process.env.CB_SECRET).toString(), backup: CryptoJS.AES.encrypt("backup-codes", process.env.CB_SECRET).toString() }],
    };
    const sequelize = new Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false });
    try {
      const queryInterface = sequelize.getQueryInterface();
      const transaction = {};
      vi.spyOn(sequelize, "transaction").mockImplementation((callback) => callback(transaction));
      vi.spyOn(sequelize, "query").mockImplementation(async (sql) => rows[sql.match(/FROM `([^`]+)`/)[1]] || []);
      const update = vi.spyOn(queryInterface, "bulkUpdate").mockImplementation(async (table, values, where, options) => {
        expect(options.transaction).toBe(transaction);
        Object.assign(rows[table].find((row) => row.id === where.id), values);
      });
      await migration.up(queryInterface);
      expect(decrypt(rows.Connection[0].password)).toBe("old-password");
      expect(decrypt(rows.Connection[0].sshPrivateKey)).toBe("old-key");
      expect(rows.Connection[0].host).toBe(existing);
      expect(decrypt(rows.OAuth[0].refreshToken)).toBe("old-token");
      expect(decrypt(rows.User2fa[0].secret)).toBe("old-seed");
      expect(decrypt(rows.User2fa[0].backup)).toBe("backup-codes");
      update.mockClear();
      await migration.up(queryInterface);
      expect(update).not.toHaveBeenCalled();
      rows.User2fa[0].secret = "unreadable";
      await expect(migration.up(queryInterface)).rejects.toThrow("Cannot decrypt");
    } finally {
      vi.restoreAllMocks();
      await sequelize.close();
    }
  });
  it("commits migrated values and rolls back unreadable data in an isolated database", async () => {
    vi.stubEnv("CB_SECRET", "change_to_random_string");
    const sequelize = new Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false });
    const qi = sequelize.getQueryInterface();
    try {
      for (const name of ["connection", "datarequest", "dataset", "datasetintelligence", "oauth", "apikey", "teaminvitation", "template", "user2fa"]) {
        const model = require(`../../models/models/${name}`)(sequelize, DataTypes);
        const columns = Object.fromEntries(Object.keys(model.rawAttributes).map((field) => [field, {
          type: field === "isEnabled" ? DataTypes.BOOLEAN : DataTypes.TEXT,
        }]));
        await qi.createTable(model.tableName, columns);
      }
      const legacy = CryptoJS.AES.encrypt("old-seed", process.env.CB_SECRET).toString();
      const sc = simplecrypt({ password: process.env.CB_SECRET, salt: "10" });
      const password = sc.encrypt("old-password");
      await qi.bulkInsert("Connection", [{ id: "1", password }]);
      await qi.bulkInsert("User2fa", [
        { id: "0", secret: "unreadable", isEnabled: false },
        { id: "2", secret: "unreadable", isEnabled: true },
        { id: "3", secret: legacy, isEnabled: false },
        { id: "4", secret: legacy, backup: "unreadable", isEnabled: false },
        { id: "5", secret: `${"0".repeat(32)}:00`, isEnabled: false },
      ]);
      await expect(migration.up(qi)).rejects.toThrow("Cannot decrypt");
      let [rows] = await sequelize.query("SELECT password FROM Connection");
      expect(rows[0].password).toBe(password);
      [rows] = await sequelize.query("SELECT id FROM User2fa");
      expect(rows).toHaveLength(5);
      await qi.bulkUpdate("User2fa", { secret: legacy }, { id: "2" });
      await migration.up(qi);
      [rows] = await sequelize.query("SELECT password FROM Connection");
      expect(decrypt(rows[0].password)).toBe("old-password");
      [rows] = await sequelize.query("SELECT id, secret, isEnabled FROM User2fa ORDER BY id");
      expect(rows.map((row) => row.id)).toEqual(["2", "3"]);
      expect(rows.map((row) => decrypt(row.secret))).toEqual(["old-seed", "old-seed"]);
      expect(rows.map((row) => row.isEnabled)).toEqual([1, 0]);
      await migration.up(qi);
      const [repeatedRows] = await sequelize.query("SELECT id, secret, isEnabled FROM User2fa ORDER BY id");
      expect(repeatedRows).toEqual(rows);
    } finally {
      await sequelize.close();
    }
  });

});
