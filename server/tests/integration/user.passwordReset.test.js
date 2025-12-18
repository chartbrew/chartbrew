import {
  describe, it, expect, beforeAll, vi
} from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { createRequire } from "module";

import { testDbManager } from "../helpers/testDbManager.js";
import { getModels } from "../helpers/dbHelpers.js";

const require = createRequire(import.meta.url);
const { encrypt } = require("../../modules/cbCrypto.js");

// We don't want to test email delivery. Mock nodemailer transport so no emails are sent.
vi.mock("nodemailer", () => ({
  createTransport: () => ({
    sendMail: vi.fn().mockResolvedValue({ ok: true }),
  }),
}));

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

    const newPassword = "newPassword456";
    const hash = encrypt(JSON.stringify({ id: user.id, email: user.email }));

    await request(app)
      .put("/user/password/change")
      .send({
        token,
        hash,
        password: newPassword,
      })
      .expect(200)
      .then((res) => {
        expect(res.body).toEqual({ completed: true });
      });

    const updatedUser = await models.User.findByPk(user.id);
    expect(updatedUser.passwordResetToken).toBeTruthy();
    expect(updatedUser.passwordResetToken).not.toBe(token);
    await expect(bcrypt.compare(newPassword, updatedUser.password)).resolves.toBe(true);
  });

  it("PUT /user/password/change should change password and rotate reset token", async () => {
    const originalPassword = "password123";
    const newPassword = "newPassword456";

    const user = await models.User.create({
      name: "Change Password User",
      email: "change.password@example.com",
      password: await bcrypt.hash(originalPassword, 10),
      active: true,
      admin: false,
      tutorials: JSON.stringify({}),
      passwordResetToken: "test-reset-token",
    });

    const hash = encrypt(JSON.stringify({ id: user.id, email: user.email }));

    await request(app)
      .put("/user/password/change")
      .send({
        token: "test-reset-token",
        hash,
        password: newPassword,
      })
      .expect(200)
      .then((res) => {
        expect(res.body).toEqual({ completed: true });
      });

    const updatedUser = await models.User.findByPk(user.id);
    expect(updatedUser.passwordResetToken).toBeTruthy();
    expect(updatedUser.passwordResetToken).not.toBe("test-reset-token");

    await expect(bcrypt.compare(newPassword, updatedUser.password)).resolves.toBe(true);
    await expect(bcrypt.compare(originalPassword, updatedUser.password)).resolves.toBe(false);
  });
});


