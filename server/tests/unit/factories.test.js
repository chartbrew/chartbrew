import { describe, it, expect } from "vitest";
import {
  userFactory, teamFactory, projectFactory, connectionFactory
} from "../factories/index.js";

describe("Factories", () => {
  describe("userFactory", () => {
    it("should create a valid user object", () => {
      const user = userFactory.build();

      expect(user).toHaveProperty("name");
      expect(user).toHaveProperty("email");
      expect(user).toHaveProperty("password");
      expect(user).toHaveProperty("active");
      expect(user).toHaveProperty("admin");
      expect(user.active).toBe(true);
      expect(user.admin).toBe(false);
      expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/); // Basic email validation
    });

    it("should create multiple users with different data", () => {
      const users = userFactory.buildMany(3);

      expect(users).toHaveLength(3);
      expect(users[0].email).not.toBe(users[1].email);
      expect(users[0].name).not.toBe(users[1].name);
    });

    it("should allow overrides", () => {
      const user = userFactory.build({
        name: "Custom Name",
        email: "custom@example.com",
        admin: true
      });

      expect(user.name).toBe("Custom Name");
      expect(user.email).toBe("custom@example.com");
      expect(user.admin).toBe(true);
    });

    it("should create admin users", () => {
      const admin = userFactory.buildAdmin();

      expect(admin.admin).toBe(true);
      expect(admin.name).toBe("Admin User");
      expect(admin.email).toBe("admin@test.com");
    });

    it("should create inactive users", () => {
      const inactiveUser = userFactory.buildInactive();

      expect(inactiveUser.active).toBe(false);
    });
  });

  describe("teamFactory", () => {
    it("should create a valid team object", () => {
      const team = teamFactory.build();

      expect(team).toHaveProperty("name");
      expect(team).toHaveProperty("showBranding");
      expect(team).toHaveProperty("allowReportRefresh");
      expect(team).toHaveProperty("allowReportExport");
      expect(team.showBranding).toBe(true);
      expect(team.allowReportRefresh).toBe(false);
      expect(team.allowReportExport).toBe(false);
    });

    it("should create teams with permissions", () => {
      const team = teamFactory.buildWithPermissions();

      expect(team.allowReportRefresh).toBe(true);
      expect(team.allowReportExport).toBe(true);
    });
  });

  describe("projectFactory", () => {
    it("should create a valid project object", () => {
      const project = projectFactory.build();

      expect(project).toHaveProperty("name");
      expect(project).toHaveProperty("brewName");
      expect(project).toHaveProperty("dashboardTitle");
      expect(project).toHaveProperty("description");
      expect(project).toHaveProperty("backgroundColor");
      expect(project.public).toBe(false);
      expect(project.passwordProtected).toBe(false);
    });

    it("should create public projects", () => {
      const project = projectFactory.buildPublic();

      expect(project.public).toBe(true);
    });

    it("should create password-protected projects", () => {
      const project = projectFactory.buildPasswordProtected();

      expect(project.passwordProtected).toBe(true);
      expect(project.password).toBeDefined();
    });
  });

  describe("connectionFactory", () => {
    it("should create a valid connection object", () => {
      const connection = connectionFactory.build();

      expect(connection).toHaveProperty("name");
      expect(connection).toHaveProperty("type");
      expect(connection).toHaveProperty("active");
      expect(connection.active).toBe(true);
      expect(connection.type).toBe("api");
    });

    it("should create MySQL connections", () => {
      const connection = connectionFactory.buildMySQL();

      expect(connection.type).toBe("mysql");
      expect(connection.port).toBe("3306");
      expect(connection.host).toBe("localhost");
    });

    it("should create PostgreSQL connections", () => {
      const connection = connectionFactory.buildPostgreSQL();

      expect(connection.type).toBe("postgres");
      expect(connection.port).toBe("5432");
    });

    it("should create API connections with auth", () => {
      const connection = connectionFactory.buildApiWithAuth();

      expect(connection.type).toBe("api");
      const auth = JSON.parse(connection.authentication);
      expect(auth.type).toBe("bearer_token");
      expect(auth.token).toBeDefined();
    });
  });
});
