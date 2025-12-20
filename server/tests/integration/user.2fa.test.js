import {
  describe, it, expect, beforeAll
} from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { TOTP } from "otpauth";

import { createTestAppWithUserRoutes } from "../helpers/testApp.js";
import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

describe("User 2FA API", () => {
  let app;
  let models;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) {
      await testDbManager.start();
    }
    app = await createTestAppWithUserRoutes();
    models = await getModels();
  });

  it("POST /user/login should return 2FA method info when 2FA is enabled", async () => {
    const password = "password123";
    const user = await models.User.create({
      name: "2FA User",
      email: "twofa.user@example.com",
      password: await bcrypt.hash(password, 10),
      active: true,
      admin: false,
      tutorials: JSON.stringify({}),
    });

    const secretBase32 = new TOTP().secret.base32;

    const method = await models.User2fa.create({
      user_id: user.id,
      method: "app",
      secret: secretBase32,
      isEnabled: true,
    });

    const response = await request(app)
      .post("/user/login")
      .send({ email: user.email, password })
      .expect(200);

    expect(response.body).toEqual({
      user_id: user.id,
      method_id: method.id,
      method: "app",
    });
  });

  it("POST /user/:id/2fa/:method_id/login should validate token and return tokenized user", async () => {
    const password = "password123";
    const user = await models.User.create({
      name: "2FA Login User",
      email: "twofa.login@example.com",
      password: await bcrypt.hash(password, 10),
      active: true,
      admin: false,
      tutorials: JSON.stringify({}),
    });

    const secretBase32 = new TOTP().secret.base32;
    const method = await models.User2fa.create({
      user_id: user.id,
      method: "app",
      secret: secretBase32,
      isEnabled: true,
    });

    const totp = new TOTP({ secret: secretBase32 });
    const token = totp.generate();

    const response = await request(app)
      .post(`/user/${user.id}/2fa/${method.id}/login`)
      // NOTE: route implementation reads method_id from body, not params
      .send({ method_id: method.id, token })
      .expect(200);

    expect(response.body).toHaveProperty("token");
    expect(response.body).toHaveProperty("id", user.id);
    expect(response.body).toHaveProperty("email", user.email);

    const updatedUser = await models.User.findByPk(user.id);
    expect(updatedUser.lastLogin).toBeTruthy();
  });

  it("POST /user/:id/2fa/:method_id/login should return 401 for invalid token", async () => {
    const password = "password123";
    const user = await models.User.create({
      name: "2FA Bad Token User",
      email: "twofa.badtoken@example.com",
      password: await bcrypt.hash(password, 10),
      active: true,
      admin: false,
      tutorials: JSON.stringify({}),
    });

    const secretBase32 = new TOTP().secret.base32;
    const method = await models.User2fa.create({
      user_id: user.id,
      method: "app",
      secret: secretBase32,
      isEnabled: true,
    });

    const response = await request(app)
      .post(`/user/${user.id}/2fa/${method.id}/login`)
      .send({ method_id: method.id, token: "000000" })
      .expect(401);

    expect(response.text).toBe("The credentials are incorrect");
  });
});
