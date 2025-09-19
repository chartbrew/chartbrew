import { testDbManager } from "./testDbManager.js";

/**
 * Database helper functions for tests
 */

export async function getModels() {
  const sequelize = testDbManager.getSequelize();
  if (!sequelize) {
    throw new Error("Database not initialized. Make sure testDbManager.start() has been called.");
  }

  // Import models using CommonJS require since models are in CommonJS format
  try {
    const path = await import("path");
    const { fileURLToPath } = await import("url");
    const { createRequire } = await import("module");

    const __filename = fileURLToPath(import.meta.url);
    const require = createRequire(import.meta.url);

    // Import the models directory
    const db = require("../../models/models/index.js");
    return db;
  } catch (error) {
    console.error("Error importing models:", error);
    throw new Error("Failed to import models. Make sure models are properly set up.");
  }
}

/**
 * Create a user in the test database
 */
export async function createUser(userData = {}) {
  const models = await getModels();
  return await models.User.create(userData);
}

/**
 * Create a team in the test database
 */
export async function createTeam(teamData = {}) {
  const models = await getModels();
  return await models.Team.create(teamData);
}

/**
 * Create a project in the test database
 */
export async function createProject(projectData = {}) {
  const models = await getModels();
  return await models.Project.create(projectData);
}

/**
 * Create a connection in the test database
 */
export async function createConnection(connectionData = {}) {
  const models = await getModels();
  return await models.Connection.create(connectionData);
}

/**
 * Create a complete test setup with user, team, and project
 */
export async function createTestSetup() {
  const models = await getModels();

  // Create team first
  const team = await models.Team.create({
    name: "Test Team",
    showBranding: true,
    allowReportRefresh: false,
    allowReportExport: false,
  });

  // Create user
  const user = await models.User.create({
    name: "Test User",
    email: "test@example.com",
    password: "$2b$10$7nM8E8XZWZWZWZWZWZWZWuvMvMvMvMvMvMvMvMvMvMvMvMvMvMvMvu", // "password123"
    active: true,
    admin: false,
    tutorials: JSON.stringify({}),
  });

  // Create project
  const project = await models.Project.create({
    name: "Test Project",
    brewName: "test-project",
    dashboardTitle: "Test Dashboard",
    description: "A test project",
    team_id: team.id,
  });

  return {
    user, team, project, models
  };
}

/**
 * Clean up all test data
 */
export async function cleanupTestData() {
  await testDbManager.cleanup();
}

/**
 * Get a fresh database connection for testing
 */
export async function getTestDbConnection() {
  return testDbManager.getSequelize();
}
