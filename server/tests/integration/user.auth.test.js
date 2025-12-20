import {
  describe, it, expect, beforeAll
} from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import simplecrypt from "simplecrypt";

import { createTestAppWithUserRoutes } from "../helpers/testApp.js";
import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

describe("User Auth API", () => {
  let app;
  let models;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) {
      await testDbManager.start();
    }
    app = await createTestAppWithUserRoutes();
    models = await getModels();
  });

  describe("POST /user (signup)", () => {
    it("should create a user and return a tokenized response", async () => {
      const payload = {
        name: "Test User",
        email: "test.user@example.com",
        password: "password123"
      };

      const response = await request(app)
        .post("/user")
        .send(payload)
        .expect(200);

      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("email", payload.email);
      expect(response.body).toHaveProperty("name", payload.name);
      expect(response.body).toHaveProperty("token");
      expect(response.body.token).toEqual(expect.any(String));

      // Ensure password is bcrypt-hashed in DB (not returned in API response)
      const createdUser = await models.User.findByPk(response.body.id);
      expect(createdUser).toBeTruthy();
      expect(createdUser.password).toMatch(/^\$2[aby]\$/);
      await expect(bcrypt.compare(payload.password, createdUser.password)).resolves.toBe(true);

      // UserController.createUser() forces active=true
      expect(createdUser.active).toBe(true);

      // Default behavior: creates a TeamRole entry when teamRestricted !== "1"
      const teamRole = await models.TeamRole.findOne({ where: { user_id: createdUser.id } });
      expect(teamRole).toBeTruthy();
      expect(teamRole.role).toBe("teamOwner");
    });

    it("should return 409 when email is already used", async () => {
      await request(app)
        .post("/user")
        .send({ name: "Dup", email: "dup@example.com", password: "password123" })
        .expect(200);

      const response = await request(app)
        .post("/user")
        .send({ name: "Dup2", email: "dup@example.com", password: "password123" })
        .expect(409);

      expect(response.text).toBe("The email is already used");
    });
  });

  describe("POST /user/login", () => {
    it("should login an existing bcrypt user and set lastLogin", async () => {
      const password = "password123";
      const bcryptHash = await bcrypt.hash(password, 10);

      const user = await models.User.create({
        name: "Login User",
        email: "login.user@example.com",
        password: bcryptHash,
        active: true,
        admin: false,
        tutorials: JSON.stringify({}),
      });

      const response = await request(app)
        .post("/user/login")
        .send({ email: user.email, password })
        .expect(200);

      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("id", user.id);

      const updatedUser = await models.User.findByPk(user.id);
      expect(updatedUser.lastLogin).toBeTruthy();
    });

    it("should return 401 when credentials are incorrect", async () => {
      const password = "password123";
      const bcryptHash = await bcrypt.hash(password, 10);

      await models.User.create({
        name: "Bad Login User",
        email: "bad.login@example.com",
        password: bcryptHash,
        active: true,
        admin: false,
        tutorials: JSON.stringify({}),
      });

      const response = await request(app)
        .post("/user/login")
        .send({ email: "bad.login@example.com", password: "wrong-password" })
        .expect(401);

      expect(response.body).toEqual({ message: "The credentials are incorrect" });
    });

    it("should migrate legacy simplecrypt password to bcrypt on successful login", async () => {
      const password = "password123";

      const sc = simplecrypt({
        password: process.env.CB_SECRET_DEV,
        salt: "10",
      });

      const legacyEncrypted = sc.encrypt(password);

      const user = await models.User.create({
        name: "Legacy User",
        email: "legacy.user@example.com",
        password: legacyEncrypted,
        active: true,
        admin: false,
        tutorials: JSON.stringify({}),
      });

      await request(app)
        .post("/user/login")
        .send({ email: user.email, password })
        .expect(200);

      const updatedUser = await models.User.findByPk(user.id);
      expect(updatedUser.password).toMatch(/^\$2[aby]\$/);
      await expect(bcrypt.compare(password, updatedUser.password)).resolves.toBe(true);
    });
  });
});
