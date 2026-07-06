import {
  describe, expect, it, vi
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { decrypt } = require("../../modules/cbCrypto.js");
const migration = require("../../models/migrations/20260706100000-encrypt-ssh-connection-fields.js");

describe("encrypt SSH connection fields migration", () => {
  it("encrypts existing plaintext SSH connection fields", async () => {
    const queryInterface = {
      queryGenerator: {
        quoteTable: vi.fn((table) => `\`${table}\``),
        quoteIdentifier: vi.fn((identifier) => `\`${identifier}\``),
      },
      changeColumn: vi.fn().mockResolvedValue(),
      sequelize: {
        query: vi.fn()
          .mockResolvedValueOnce([{
            id: 7,
            sshHost: "ssh.example.com",
            sshUsername: "deploy",
            sshPassword: "ssh-password",
            sshPrivateKey: ".connectionFiles/private-key",
            sshPassphrase: "key-passphrase",
            sshJumpHost: "bastion.example.com",
          }])
          .mockResolvedValueOnce(),
      },
    };

    await migration.up(queryInterface);

    const updateCall = queryInterface.sequelize.query.mock.calls[1];
    const replacements = updateCall[1].replacements;

    expect(replacements.id).toBe(7);
    expect(decrypt(replacements.sshHost)).toBe("ssh.example.com");
    expect(decrypt(replacements.sshUsername)).toBe("deploy");
    expect(decrypt(replacements.sshPassword)).toBe("ssh-password");
    expect(decrypt(replacements.sshPrivateKey)).toBe(".connectionFiles/private-key");
    expect(decrypt(replacements.sshPassphrase)).toBe("key-passphrase");
    expect(decrypt(replacements.sshJumpHost)).toBe("bastion.example.com");
  });
});
