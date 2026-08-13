import {
  describe, expect, it, vi
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const migration = require(
  "../../models/migrations/20260812110000-add-orchestrator-session-binding-hash.js"
);

describe("orchestrator action audit session binding migration", () => {
  it("adds the session binding hash when it is missing", async () => {
    const queryInterface = {
      addColumn: vi.fn().mockResolvedValue(),
      describeTable: vi.fn().mockResolvedValue({}),
    };

    await migration.up(queryInterface);

    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "OrchestratorActionAudit",
      "session_binding_hash",
      expect.objectContaining({ allowNull: true })
    );
  });

  it("does not add the session binding hash when it exists", async () => {
    const queryInterface = {
      addColumn: vi.fn().mockResolvedValue(),
      describeTable: vi.fn().mockResolvedValue({ session_binding_hash: {} }),
    };

    await migration.up(queryInterface);

    expect(queryInterface.addColumn).not.toHaveBeenCalled();
  });

  it("removes the session binding hash during rollback", async () => {
    const queryInterface = {
      describeTable: vi.fn().mockResolvedValue({ session_binding_hash: {} }),
      removeColumn: vi.fn().mockResolvedValue(),
    };

    await migration.down(queryInterface);

    expect(queryInterface.removeColumn).toHaveBeenCalledWith(
      "OrchestratorActionAudit",
      "session_binding_hash"
    );
  });
});
