const { DataTypes, Sequelize } = require("sequelize");

const keyMigration = require("../../models/migrations/20260825090000-add-data-api-key-scope");
const auditMigration = require("../../models/migrations/20260825091000-add-data-api-audit-key");

describe("Data API migrations", () => {
  it("adds, backfills, indexes, and removes the fields on SQLite", async () => {
    const sequelize = new Sequelize("sqlite::memory:", { logging: false });
    const queryInterface = sequelize.getQueryInterface();
    try {
      await queryInterface.createTable("Apikey", {
        id: { type: DataTypes.UUID, primaryKey: true },
        name: { type: DataTypes.STRING, allowNull: false },
        token: { type: DataTypes.TEXT, allowNull: false },
        team_id: { type: DataTypes.INTEGER, allowNull: false },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      await queryInterface.createTable("UpdateRun", {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        traceId: { type: DataTypes.STRING, allowNull: false },
        rootTraceId: { type: DataTypes.STRING, allowNull: false },
        triggerType: { type: DataTypes.STRING, allowNull: false },
        entityType: { type: DataTypes.STRING, allowNull: false },
        status: { type: DataTypes.STRING, allowNull: false },
        startedAt: { type: DataTypes.DATE, allowNull: false },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      await queryInterface.bulkInsert("Apikey", [{
        id: "48f81a1f-c730-435c-a2b7-6b72f5f775ce",
        name: "Legacy key",
        token: "encrypted",
        team_id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      await keyMigration.up(queryInterface);
      await auditMigration.up(queryInterface);

      const keyColumns = await queryInterface.describeTable("Apikey");
      expect(Object.keys(keyColumns)).toEqual(expect.arrayContaining([
        "user_id", "scopes", "project_ids", "all_projects", "last_used_at",
      ]));
      expect(keyColumns.scopes.allowNull).toBe(false);
      const [legacyRows] = await sequelize.query("SELECT scopes FROM Apikey");
      expect(legacyRows).toEqual([{ scopes: "[]" }]);

      const auditColumns = await queryInterface.describeTable("UpdateRun");
      expect(auditColumns.apiKeyId).toBeTruthy();
      expect((await queryInterface.showIndex("UpdateRun")).map((index) => index.name))
        .toContain("update_run_api_key_started_at");

      await auditMigration.down(queryInterface);
      await keyMigration.down(queryInterface);
      expect((await queryInterface.describeTable("UpdateRun")).apiKeyId).toBeUndefined();
      expect((await queryInterface.describeTable("Apikey")).scopes).toBeUndefined();
    } finally {
      await sequelize.close();
    }
  });
});
