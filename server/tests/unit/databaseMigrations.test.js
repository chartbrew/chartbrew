import {
  describe, expect, it, vi
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { shouldMigrateOnStartup } = require("../../modules/databaseMigrations");
const repairMigration = require(
  "../../models/migrations/20260814100000-repair-ai-message-access-columns.js"
);
const historyScopeMigration = require("../../models/migrations/20261029100000-add-ai-message-access-scope.js");

describe("database migrations", () => {
  it("adds a nullable history scope without assigning access to old messages", async () => {
    const queryInterface = {
      addColumn: vi.fn().mockResolvedValue(),
      describeTable: vi.fn().mockResolvedValue({}),
    };
    await historyScopeMigration.up(queryInterface);
    expect(queryInterface.addColumn).toHaveBeenCalledWith("AiMessage", "workspace_access_scope",
      expect.objectContaining({ allowNull: true }));
    queryInterface.addColumn.mockClear();
    queryInterface.describeTable.mockResolvedValue({ workspace_access_scope: {} });
    await historyScopeMigration.up(queryInterface);
    expect(queryInterface.addColumn).not.toHaveBeenCalled();
  });

  it("runs migrations automatically only in production", () => {
    expect(shouldMigrateOnStartup("production")).toBe(true);
    expect(shouldMigrateOnStartup("development")).toBe(false);
    expect(shouldMigrateOnStartup("test")).toBe(false);
    expect(shouldMigrateOnStartup()).toBe(false);
  });

  it("repairs missing AI message access columns", async () => {
    const queryInterface = {
      addColumn: vi.fn().mockResolvedValue(),
      describeTable: vi.fn().mockResolvedValue({}),
    };

    await repairMigration.up(queryInterface);

    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "AiMessage",
      "sensitive_workspace_context",
      expect.objectContaining({ allowNull: false, defaultValue: false })
    );
    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "AiMessage",
      "workspace_access_version",
      expect.objectContaining({ allowNull: true })
    );
  });

  it("does not change existing AI message access columns", async () => {
    const queryInterface = {
      addColumn: vi.fn().mockResolvedValue(),
      describeTable: vi.fn().mockResolvedValue({
        sensitive_workspace_context: {},
        workspace_access_version: {},
      }),
    };

    await repairMigration.up(queryInterface);

    expect(queryInterface.addColumn).not.toHaveBeenCalled();
  });

  it("does not remove columns during rollback because they can predate the repair", async () => {
    const queryInterface = {
      removeColumn: vi.fn().mockResolvedValue(),
    };

    await repairMigration.down(queryInterface);

    expect(queryInterface.removeColumn).not.toHaveBeenCalled();
  });
});
