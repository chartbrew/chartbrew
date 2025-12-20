import {
  describe, it, expect, beforeAll
} from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { testDbManager } from "../helpers/testDbManager.js";
import { getModels } from "../helpers/dbHelpers.js";

describe("User Email Update API", () => {
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

  it("should request email update and then update user email using a valid token", async () => {
    const user = await models.User.create({
      name: "Email Update User",
      email: "old.email@example.com",
      password: await bcrypt.hash("password123", 10),
      active: true,
      admin: false,
      tutorials: JSON.stringify({}),
    });

    const authToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.CB_ENCRYPTION_KEY_DEV,
      { expiresIn: "1h" }
    );

    const newEmail = "new.email@example.com";

    await request(app)
      .post(`/user/${user.id}/email/verify`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ email: newEmail })
      .expect(200)
      .then((res) => {
        expect(res.body).toEqual({ success: true });
      });

    // We don't test email delivery. Instead, generate a valid verification token
    // with the same payload/signing key as UserController.requestEmailUpdate().
    const token = jwt.sign(
      { id: user.id, email: user.email, newEmail },
      process.env.CB_ENCRYPTION_KEY_DEV,
      { expiresIn: "3h" }
    );

    const response = await request(app)
      .put(`/user/${user.id}/email/update`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ token })
      .expect(200);

    expect(response.body).toHaveProperty("id", user.id);
    expect(response.body).toHaveProperty("email", newEmail);
  });

  it("should not update email if verification token is invalid", async () => {
    const user = await models.User.create({
      name: "Bad Token User",
      email: "bad.token.old@example.com",
      password: await bcrypt.hash("password123", 10),
      active: true,
      admin: false,
      tutorials: JSON.stringify({}),
    });

    const authToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.CB_ENCRYPTION_KEY_DEV,
      { expiresIn: "1h" }
    );

    await request(app)
      .put(`/user/${user.id}/email/update`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ token: "not-a-valid-jwt" })
      .expect(400);

    const refreshed = await models.User.findByPk(user.id);
    expect(refreshed.email).toBe("bad.token.old@example.com");
  });
});
