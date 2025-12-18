import {
  describe, it, expect, beforeAll
} from "vitest";
import request from "supertest";
import { createTestAppWithUserRoutes } from "../helpers/testApp.js";
import { testDbManager } from "../helpers/index.js";
import { userFactory } from "../factories/userFactory.js";
import { getModels } from "../helpers/dbHelpers.js";
import { getAuthHeaders, generateTestToken } from "../helpers/authHelpers.js";

describe("User Management API", () => {
  let app, models;

  beforeAll(async () => {
    // Ensure database is started
    if (!testDbManager.getSequelize()) {
      await testDbManager.start();
    }

    app = await createTestAppWithUserRoutes();
    models = await getModels();
  });

  describe("PUT /user/:id (profile update)", () => {
    it("should update user profile when authenticated as the same user", async () => {
      // Create a test user
      const testUserData = userFactory.build({
        name: "Original Name",
        email: "original@example.com"
      });
      const testUser = await models.User.create(testUserData);

      const token = generateTestToken({
        id: testUser.id,
        email: "original@example.com",
        name: testUser.name
      });

      const response = await request(app)
        .put(`/user/${testUser.id}`)
        .set(getAuthHeaders(token))
        .send({
          name: "Updated Name",
          tutorials: JSON.stringify({ tutorial1: true })
        })
        .expect(200);

      expect(response.body.name).toBe("Updated Name");
      expect(response.body.email).toBe(testUser.email); // Email should remain unchanged
      expect(response.body.tutorials).toBe(JSON.stringify({ tutorial1: true }));
    });

    it("should return 401 when not authenticated", async () => {
      const testUser = await models.User.create(userFactory.build());

      await request(app)
        .put(`/user/${testUser.id}`)
        .send({}) // Empty body
        .expect(401);
    });

    it("should return 401 when trying to update another user's profile", async () => {
      // Create two users
      const user1 = await models.User.create(userFactory.build());
      const user2 = await models.User.create(userFactory.build());

      // Try to update user2's profile while authenticated as user1
      const token1 = generateTestToken({
        id: user1.id,
        email: user1.email,
        name: user1.name
      });

      await request(app)
        .put(`/user/${user2.id}`)
        .set(getAuthHeaders(token1))
        .send({ name: "Hacked Name" })
        .expect(401);
    });

    it("should prevent admin field from being set through user update", async () => {
      const userData = userFactory.build();
      const testUser = await models.User.create(userData);
      await testUser.reload(); // Reload to ensure getters work properly

      // Try to set admin=true through the update API
      const adminToken = generateTestToken({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name
      });

      const response = await request(app)
        .put(`/user/${testUser.id}`)
        .set(getAuthHeaders(adminToken))
        .send({
          name: "Updated Name",
          admin: true // This should be ignored
        })
        .expect(200);

      expect(response.body.name).toBe("Updated Name");
      // API response doesn't include admin; ensure DB value is still false.
      const refreshedUser = await models.User.findByPk(testUser.id);
      expect(refreshedUser.admin).toBe(false);
    });
  });

  describe("DELETE /user/:id (user deletion)", () => {
    it("should allow a user to delete their own account", async () => {
      const userData = userFactory.build();
      const testUser = await models.User.create(userData);
      await testUser.reload(); // Reload to ensure getters work properly

      const deleteToken = generateTestToken({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name
      });

      await request(app)
        .delete(`/user/${testUser.id}`)
        .set(getAuthHeaders(deleteToken))
        .expect(200);

      // Verify user is deleted
      const deletedUser = await models.User.findByPk(testUser.id);
      expect(deletedUser).toBeNull();
    });

    it("should return 401 when trying to delete another user's account", async () => {
      // Create two users
      const user1 = await models.User.create(userFactory.build());
      const user2 = await models.User.create(userFactory.build());

      // Try to delete user2's account while authenticated as user1
      const token1 = generateTestToken({
        id: user1.id,
        email: user1.email,
        name: user1.name
      });

      await request(app)
        .delete(`/user/${user2.id}`)
        .set(getAuthHeaders(token1))
        .expect(401);

      // Verify user2 still exists
      const stillExists = await models.User.findByPk(user2.id);
      expect(stillExists).not.toBeNull();
    });
  });

  describe("GET /user/:id (get user by ID)", () => {
    it("should return user data when authenticated as the same user", async () => {
      const userData = userFactory.build();
      const testUser = await models.User.create(userData);
      await testUser.reload(); // Reload to ensure getters work properly


      const token = generateTestToken({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name
      });

      const response = await request(app)
        .get(`/user/${testUser.id}`)
        .set(getAuthHeaders(token))
        .expect(200);

      expect(response.body.name).toBe(testUser.name);
      expect(response.body.email).toBe(testUser.email);
      expect(response.body).not.toHaveProperty("password"); // Password should be excluded
    });
  });

  describe("GET /user (admin only - list all users)", () => {
    it("should return 401 when authenticated as non-admin user", async () => {
      const regularUser = await models.User.create(userFactory.build());

      const regularToken = generateTestToken({
        id: regularUser.id,
        email: regularUser.email,
        name: regularUser.name
      });

      await request(app)
        .get("/user")
        .set(getAuthHeaders(regularToken))
        .expect(401);
    });

    it("should return 401 when not authenticated", async () => {
      await request(app)
        .get("/user")
        .expect(401);
    });
  });
});
