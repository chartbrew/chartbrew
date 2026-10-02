import {
  describe, it, expect, beforeAll, vi
} from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { createRequire } from "module";

import { testDbManager } from "../helpers/testDbManager.js";
import { getModels } from "../helpers/dbHelpers.js";

const require = createRequire(import.meta.url);
const { decrypt, encrypt } = require("../../modules/cbCrypto.js");

// We don't want to test email delivery. Mock nodemailer transport so no emails are sent.
vi.mock("nodemailer", () => ({
  createTransport: () => ({
    sendMail: vi.fn().mockResolvedValue({ ok: true }),
  }),
}));

const mail = require("../../modules/mail.js");
const passwordResetMock = vi.spyOn(mail, "passwordReset").mockResolvedValue({ ok: true });

describe("User Password Reset API", () => {
  let app;
  let models;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) {
      await testDbManager.start();
    }

    // Import after mocks are registered
    const { createTestAppWithUserRoutes } = await import("../helpers/testApp.js");
    app = await createTestAppWithUserRoutes();
    models = await getModels();
  });

  it("should reset password end-to-end using the generated token", async () => {
    const resetRequestedAt = Date.now();
    const user = await models.User.create({
      name: "Reset User",
      email: "reset.user@example.com",
      password: await bcrypt.hash("password123", 10),
      active: true,
      admin: false,
      tutorials: JSON.stringify({}),
    });

    await request(app)
      .post("/user/password/reset")
      .send({ email: user.email })
      .expect(200)
      .then((res) => {
        expect(res.body).toEqual({ success: true });
      });

    // Route is fire-and-forget, so wait until controller finishes DB update.
    const token = await new Promise((resolve, reject) => {
      const start = Date.now();
      const timer = setInterval(async () => {
        const updatedUser = await models.User.findByPk(user.id);
        if (updatedUser?.passwordResetToken) {
          clearInterval(timer);
          resolve(updatedUser.passwordResetToken);
          return;
        }
        if (Date.now() - start > 5000) {
          clearInterval(timer);
          reject(new Error("Timed out waiting for passwordResetToken to be set"));
        }
      }, 50);
    });

    const expiresAt = Number(token.slice(token.lastIndexOf(".") + 1));
    expect(expiresAt).toBeGreaterThan(Date.now());
    expect(expiresAt).toBeGreaterThanOrEqual(resetRequestedAt + (30 * 60 * 1000));
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + (30 * 60 * 1000));
    await vi.waitFor(() => expect(passwordResetMock).toHaveBeenCalled());
    const resetUrl = new URL(passwordResetMock.mock.calls.at(-1)[0].resetUrl);
    expect(resetUrl.searchParams.get("token")).toBe(token);
    expect(resetUrl.searchParams.has("hash")).toBe(false);

    const newPassword = "newPassword456";
    await request(app)
      .put("/user/password/change")
      .send({
        token,
        password: newPassword,
      })
      .expect(200)
      .then((res) => {
        expect(res.body).toEqual({ completed: true });
      });

    const updatedUser = await models.User.findByPk(user.id);
    expect(updatedUser.passwordResetToken).toBeNull();
    await expect(bcrypt.compare(newPassword, updatedUser.password)).resolves.toBe(true);
  });

  it("changes the password and consumes the reset token", async () => {
    const originalPassword = "password123";
    const newPassword = "newPassword456";

    const user = await models.User.create({
      name: "Change Password User",
      email: "change.password@example.com",
      password: await bcrypt.hash(originalPassword, 10),
      active: true,
      admin: false,
      tutorials: JSON.stringify({}),
      passwordResetToken: `test-reset-token.${Date.now() + 60000}`,
    });

    const token = user.passwordResetToken;

    await request(app)
      .put("/user/password/change")
      .send({
        token,
        password: newPassword,
      })
      .expect(200)
      .then((res) => {
        expect(res.body).toEqual({ completed: true });
      });

    const updatedUser = await models.User.findByPk(user.id);
    expect(updatedUser.passwordResetToken).toBeNull();

    await expect(bcrypt.compare(newPassword, updatedUser.password)).resolves.toBe(true);
    await expect(bcrypt.compare(originalPassword, updatedUser.password)).resolves.toBe(false);

    await request(app)
      .put("/user/password/change")
      .send({ token, password: "replayedPassword789" })
      .expect(400);

    const userAfterReplay = await models.User.findByPk(user.id);
    await expect(bcrypt.compare(newPassword, userAfterReplay.password)).resolves.toBe(true);
  });

  it("rejects expired reset tokens", async () => {
    const originalPassword = "password123";
    const token = `expired-token.${Date.now() - 1}`;
    const user = await models.User.create({
      name: "Expired Reset User",
      email: "expired.reset@example.com",
      password: await bcrypt.hash(originalPassword, 10),
      active: true,
      admin: false,
      tutorials: JSON.stringify({}),
      passwordResetToken: token,
    });

    await request(app)
      .put("/user/password/change")
      .send({ token, password: "newPassword456" })
      .expect(400);

    const updatedUser = await models.User.findByPk(user.id);
    await expect(bcrypt.compare(originalPassword, updatedUser.password)).resolves.toBe(true);
  });

  it("rejects invalid new passwords", async () => {
    const originalPassword = "password123";
    const token = `valid-token.${Date.now() + 60000}`;
    const user = await models.User.create({
      name: "Invalid Password User",
      email: "invalid.password@example.com",
      password: await bcrypt.hash(originalPassword, 10),
      active: true,
      admin: false,
      tutorials: JSON.stringify({}),
      passwordResetToken: token,
    });

    await request(app)
      .put("/user/password/change")
      .send({ token, password: "short" })
      .expect(400);

    const updatedUser = await models.User.findByPk(user.id);
    expect(updatedUser.passwordResetToken).toBe(token);
    await expect(bcrypt.compare(originalPassword, updatedUser.password)).resolves.toBe(true);
  });

  it("rejects a modified reset hash and null token", async () => {
    const originalPassword = "password123";
    const victim = await models.User.create({
      id: 24,
      name: "Reset Target",
      email: "reset.target@example.com",
      password: await bcrypt.hash(originalPassword, 10),
      active: true,
      admin: false,
      tutorials: JSON.stringify({}),
      passwordResetToken: null,
    });
    const attacker = await models.User.create({
      id: 25,
      name: "Reset Attacker",
      email: "reset.attacker@example.com",
      password: await bcrypt.hash(originalPassword, 10),
      active: true,
      admin: false,
      tutorials: JSON.stringify({}),
    });

    const [ivHex, ciphertext] = encrypt(JSON.stringify({
      id: attacker.id,
      email: attacker.email,
    })).split(":");
    const iv = Buffer.from(ivHex, "hex");
    const idOffset = Buffer.byteLength("{\"id\":");
    const attackerId = Buffer.from(String(attacker.id));
    const victimId = Buffer.from(String(victim.id));
    attackerId.forEach((byte, index) => {
      iv[idOffset + index] ^= byte ^ victimId[index];
    });
    const modifiedHash = `${iv.toString("hex")}:${ciphertext}`;
    expect(JSON.parse(decrypt(modifiedHash)).id).toBe(victim.id);

    await request(app)
      .put("/user/password/change")
      .send({
        token: null,
        hash: modifiedHash,
        password: "newPassword456",
      })
      .expect(400);

    const updatedUser = await models.User.findByPk(victim.id);
    await expect(bcrypt.compare(originalPassword, updatedUser.password)).resolves.toBe(true);
  });
});
