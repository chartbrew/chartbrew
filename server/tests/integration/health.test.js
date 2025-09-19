import {
  describe, it, expect, beforeAll
} from "vitest";
import request from "supertest";
import { createTestApp } from "../helpers/testApp.js";
import { testDbManager } from "../helpers/index.js";

describe("Health Check API", () => {
  let app;

  beforeAll(async () => {
    // Database is already started in globalSetup.js
    app = await createTestApp();
  });

  describe("GET /", () => {
    it("should return a welcome message", async () => {
      const response = await request(app)
        .get("/")
        .expect(200);

      expect(response.body).toEqual({
        message: "Chartbrew Test API",
        status: "ok"
      });
    });

    it("should have correct content-type header", async () => {
      const response = await request(app)
        .get("/")
        .expect(200);

      expect(response.headers["content-type"]).toMatch(/json/);
    });
  });

  describe("Database Connection", () => {
    it("should have a working database connection", async () => {
      // Ensure database is initialized (it should be from global setup)
      if (!testDbManager.getSequelize()) {
        await testDbManager.start();
      }

      const sequelize = testDbManager.getSequelize();
      expect(sequelize).toBeDefined();
      expect(sequelize).not.toBeNull();

      // Test authentication
      await expect(sequelize.authenticate()).resolves.not.toThrow();
    });

    it("should return database connection details", () => {
      const connectionDetails = testDbManager.getConnectionDetails();

      expect(connectionDetails).toHaveProperty("database");
      expect(connectionDetails).toHaveProperty("dialect");

      // Different checks for different database types
      if (connectionDetails.dialect === "sqlite") {
        expect(connectionDetails.database).toBe(":memory:");
      } else {
        expect(connectionDetails).toHaveProperty("host");
        expect(connectionDetails).toHaveProperty("port");
        expect(connectionDetails).toHaveProperty("username");
        expect(connectionDetails.database).toBe("chartbrew_test");
      }
    });
  });
});
