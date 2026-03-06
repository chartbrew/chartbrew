import {
  describe, it, expect, beforeAll
} from "vitest";
import request from "supertest";
import { createTestAppWithUserRoutes } from "../helpers/testApp.js";
import { testDbManager } from "../helpers/index.js";
import { userFactory } from "../factories/userFactory.js";
import { teamFactory } from "../factories/teamFactory.js";
import { projectFactory } from "../factories/projectFactory.js";
import { getModels } from "../helpers/dbHelpers.js";
import { getAuthHeaders, generateTestToken } from "../helpers/authHelpers.js";

async function getRestrictiveForeignKeyTables(models, referencedTable) {
  const { sequelize } = models;
  const dialect = sequelize.getDialect();

  if (dialect === "mysql") {
    const [rows] = await sequelize.query(`
      SELECT
        kcu.TABLE_NAME AS tableName,
        kcu.COLUMN_NAME AS columnName,
        rc.DELETE_RULE AS deleteRule
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      INNER JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
        AND rc.TABLE_NAME = kcu.TABLE_NAME
        AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE kcu.CONSTRAINT_SCHEMA = DATABASE()
        AND kcu.REFERENCED_TABLE_NAME = :referencedTable
        AND rc.DELETE_RULE IN ("RESTRICT", "NO ACTION")
    `, {
      replacements: { referencedTable }
    });
    return rows;
  }

  if (dialect === "postgres") {
    const [rows] = await sequelize.query(`
      SELECT
        kcu.table_name AS "tableName",
        kcu.column_name AS "columnName",
        rc.delete_rule AS "deleteRule"
      FROM information_schema.table_constraints tc
      INNER JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      INNER JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      INNER JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = current_schema()
        AND LOWER(ccu.table_name) = LOWER(:referencedTable)
        AND rc.delete_rule IN ('RESTRICT', 'NO ACTION')
    `, {
      replacements: { referencedTable }
    });
    return rows;
  }

  if (dialect === "sqlite") {
    const [tables] = await sequelize.query(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE 'SequelizeMeta%'
    `);
    const rows = [];

    /* eslint-disable no-await-in-loop */
    for (const table of tables) {
      const tableName = table.name;
      const escaped = tableName.replace(/'/g, "''");
      const [fks] = await sequelize.query(`PRAGMA foreign_key_list('${escaped}')`);
      fks.forEach((fk) => {
        const deleteRule = (fk.on_delete || "NO ACTION").toUpperCase();
        if (fk.table === referencedTable && (deleteRule === "RESTRICT" || deleteRule === "NO ACTION")) {
          rows.push({
            tableName,
            columnName: fk.from,
            deleteRule
          });
        }
      });
    }
    /* eslint-enable no-await-in-loop */

    return rows;
  }

  return [];
}

describe("User Management API", () => {
  let app;
  let models;

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

    it("should delete AI conversation dependencies before deleting user", async () => {
      const user = await models.User.create(userFactory.build());
      const team = await models.Team.create(teamFactory.build());

      const conversation = await models.AiConversation.create({
        team_id: team.id,
        user_id: user.id,
        title: "Delete me first"
      });

      await models.AiMessage.create({
        conversation_id: conversation.id,
        role: "user",
        content: "hello",
        sequence: 0
      });

      const usage = await models.AiUsage.create({
        conversation_id: conversation.id,
        team_id: team.id,
        model: "gpt-4o-mini",
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      });

      const token = generateTestToken({
        id: user.id,
        email: user.email,
        name: user.name
      });

      await request(app)
        .delete(`/user/${user.id}`)
        .set(getAuthHeaders(token))
        .expect(200);

      const deletedUser = await models.User.findByPk(user.id);
      const deletedConversation = await models.AiConversation.findByPk(conversation.id);
      const deletedMessages = await models.AiMessage.count({
        where: { conversation_id: conversation.id }
      });
      const detachedUsage = await models.AiUsage.findByPk(usage.id);

      expect(deletedUser).toBeNull();
      expect(deletedConversation).toBeNull();
      expect(deletedMessages).toBe(0);
      expect(detachedUsage).not.toBeNull();
      expect(detachedUsage.conversation_id).toBeNull();
    });

    it("should delete team-owned dependencies before deleting owned team", async () => {
      const user = await models.User.create(userFactory.build());
      const collaborator = await models.User.create(userFactory.build());
      const team = await models.Team.create(teamFactory.build());
      const project = await models.Project.create(projectFactory.build({ team_id: team.id }));

      await models.TeamRole.create({
        user_id: user.id,
        team_id: team.id,
        role: "teamOwner",
        canExport: true
      });

      await models.PinnedDashboard.create({
        team_id: team.id,
        project_id: project.id,
        user_id: user.id
      });

      await models.SavedQuery.create({
        team_id: team.id,
        user_id: user.id,
        summary: "cleanup test",
        query: "SELECT 1",
        type: "sql"
      });

      await models.DashboardFilter.create({
        project_id: project.id,
        configuration: { type: "select", key: "country" },
        onReport: true
      });

      await models.Variable.create({
        project_id: project.id,
        name: "country"
      });

      await models.ProjectRole.create({
        user_id: collaborator.id,
        project_id: project.id,
        role: "admin"
      });

      const token = generateTestToken({
        id: user.id,
        email: user.email,
        name: user.name
      });

      await request(app)
        .delete(`/user/${user.id}`)
        .set(getAuthHeaders(token))
        .expect(200);

      const deletedUser = await models.User.findByPk(user.id);
      const deletedTeam = await models.Team.findByPk(team.id);
      const pinnedCount = await models.PinnedDashboard.count({ where: { team_id: team.id } });
      const savedQueryCount = await models.SavedQuery.count({ where: { team_id: team.id } });
      const dashboardFilterCount = await models.DashboardFilter.count({
        where: { project_id: project.id }
      });
      const variableCount = await models.Variable.count({ where: { project_id: project.id } });
      const projectRoleCount = await models.ProjectRole.count({
        where: { project_id: project.id }
      });

      expect(deletedUser).toBeNull();
      expect(deletedTeam).toBeNull();
      expect(pinnedCount).toBe(0);
      expect(savedQueryCount).toBe(0);
      expect(dashboardFilterCount).toBe(0);
      expect(variableCount).toBe(0);
      expect(projectRoleCount).toBe(0);
    });

    it("should keep restrictive foreign key coverage explicit for user/team deletion", async () => {
      const handledUserTables = new Set([
        "aiconversation",
        "chartcache",
        "pinneddashboard",
        "projectrole",
        "savedquery",
        "teaminvitation",
        "teamrole",
        "user2fa"
      ]);

      const handledTeamTables = new Set([
        "aiconversation",
        "aiusage",
        "apikey",
        "connection",
        "dashboardfilter",
        "dataset",
        "integration",
        "oauth",
        "pinneddashboard",
        "project",
        "savedquery",
        "teaminvitation",
        "teamrole",
        "template",
        "variable"
      ]);

      const restrictiveUserRefs = await getRestrictiveForeignKeyTables(models, "User");
      const restrictiveTeamRefs = await getRestrictiveForeignKeyTables(models, "Team");
      const restrictiveProjectRefs = await getRestrictiveForeignKeyTables(models, "Project");

      const uncoveredUserRefs = restrictiveUserRefs.filter((ref) => {
        return !handledUserTables.has(String(ref.tableName).toLowerCase());
      });

      const uncoveredTeamRefs = restrictiveTeamRefs.filter((ref) => {
        return !handledTeamTables.has(String(ref.tableName).toLowerCase());
      });

      const handledProjectTables = new Set([
        "chart",
        "dashboardfilter",
        "pinneddashboard",
        "projectrole",
        "variable"
      ]);

      const uncoveredProjectRefs = restrictiveProjectRefs.filter((ref) => {
        return !handledProjectTables.has(String(ref.tableName).toLowerCase());
      });

      expect(uncoveredUserRefs).toEqual([]);
      expect(uncoveredTeamRefs).toEqual([]);
      expect(uncoveredProjectRefs).toEqual([]);
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
