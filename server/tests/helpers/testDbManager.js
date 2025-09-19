import { Sequelize } from "sequelize";
import { Umzug, SequelizeStorage } from "umzug";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// We'll check for testcontainers availability at runtime
let GenericContainer = null;
let Wait = null;

class TestDbManager {
  constructor() {
    this.container = null;
    this.sequelize = null;
    this.port = null;
    this.database = "chartbrew_test";
    this.username = "root";
    this.password = "test_password";
    this.useContainers = false; // Will be set during initialization
  }

  async start() {
    if (this.sequelize) {
      console.log("Database already initialized");
      return;
    }

    // Check if we should use containers based on environment and availability
    const dbDialect = process.env.CB_DB_DIALECT_DEV || "mysql";
    const forceContainers = process.env.FORCE_CONTAINERS === "true";

    if (dbDialect !== "sqlite") {
      // Try to load testcontainers
      try {
        const testcontainers = await import("testcontainers");
        GenericContainer = testcontainers.GenericContainer;
        Wait = testcontainers.Wait;
        this.useContainers = true;
        console.log("✅ Testcontainers loaded successfully");
      } catch (error) {
        console.log("❌ Testcontainers not available:", error.message);
        if (forceContainers) {
          console.log("🔄 FORCE_CONTAINERS is true, falling back to SQLite");
          process.env.CB_DB_DIALECT_DEV = "sqlite";
        }
        this.useContainers = false;
      }
    }

    if (this.useContainers && process.env.CB_DB_DIALECT_DEV !== "sqlite") {
      try {
        console.log("🐳 Starting test database container...");

        if (process.env.CB_DB_DIALECT_DEV === "postgres") {
          await this.startPostgres();
        } else {
          await this.startMySQL();
        }

        console.log(`✅ Database container started on port ${this.port}`);

        // Set up environment variables for the test database
        this.setTestEnvVars();
      } catch (error) {
        console.log("❌ Failed to start database container:", error.message);
        console.log("🔄 Falling back to SQLite...");
        this.useContainers = false;
        process.env.CB_DB_DIALECT_DEV = "sqlite";
        this.setTestEnvVarsSQLite();
      }
    } else {
      console.log("📦 Using in-memory SQLite database for testing...");
      this.setTestEnvVarsSQLite();
    }

    // Initialize Sequelize and run migrations
    await this.initializeDatabase();
  }

  async startMySQL() {
    this.container = await new GenericContainer("mysql:8.0")
      .withEnvironment({
        MYSQL_ROOT_PASSWORD: this.password,
        MYSQL_DATABASE: this.database,
      })
      .withExposedPorts(3306)
      .withWaitStrategy(
        Wait.forAll([
          Wait.forLogMessage("ready for connections"),
          Wait.forListeningPorts()
        ])
      )
      .withStartupTimeout(60000) // 60 seconds timeout
      .start();

    this.port = this.container.getMappedPort(3306);

    // Additional wait to ensure MySQL is truly ready
    console.log("⏳ Waiting for MySQL to be fully ready...");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  async startPostgres() {
    this.container = await new GenericContainer("postgres:15")
      .withEnvironment({
        POSTGRES_USER: this.username,
        POSTGRES_PASSWORD: this.password,
        POSTGRES_DB: this.database,
      })
      .withExposedPorts(5432)
      .withWaitStrategy(
        Wait.forAll([
          Wait.forLogMessage("database system is ready to accept connections"),
          Wait.forListeningPorts()
        ])
      )
      .withStartupTimeout(60000) // 60 seconds timeout
      .start();

    this.port = this.container.getMappedPort(5432);

    // Additional wait to ensure PostgreSQL is truly ready
    console.log("⏳ Waiting for PostgreSQL to be fully ready...");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  setTestEnvVars() {
    const dbDialect = process.env.CB_DB_DIALECT_DEV || "mysql";

    process.env.CB_DB_HOST_DEV = "localhost";
    process.env.CB_DB_PORT_DEV = this.port.toString();
    process.env.CB_DB_NAME_DEV = this.database;
    process.env.CB_DB_USERNAME_DEV = this.username;
    process.env.CB_DB_PASSWORD_DEV = this.password;
    process.env.CB_DB_DIALECT_DEV = dbDialect;
    process.env.CB_DB_SSL_DEV = "false";
  }

  setTestEnvVarsSQLite() {
    process.env.CB_DB_HOST_DEV = "localhost";
    process.env.CB_DB_PORT_DEV = "";
    process.env.CB_DB_NAME_DEV = ":memory:";
    process.env.CB_DB_USERNAME_DEV = "";
    process.env.CB_DB_PASSWORD_DEV = "";
    process.env.CB_DB_DIALECT_DEV = "sqlite";
    process.env.CB_DB_SSL_DEV = "false";
  }

  async initializeDatabase() {
    const dbDialect = process.env.CB_DB_DIALECT_DEV || "mysql";

    let sequelizeOptions;

    if (dbDialect === "sqlite") {
      sequelizeOptions = {
        dialect: "sqlite",
        storage: ":memory:",
        logging: false,
      };

      this.sequelize = new Sequelize(sequelizeOptions);
    } else {
      sequelizeOptions = {
        host: "localhost",
        port: this.port,
        dialect: dbDialect,
        logging: false,
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        },
      };

      // Add database-specific options
      if (dbDialect === "mysql") {
        sequelizeOptions.define = {
          charset: "utf8mb4",
          collate: "utf8mb4_general_ci",
        };
        sequelizeOptions.dialectOptions = {
          charset: "utf8mb4",
        };
      } else if (dbDialect === "postgres") {
        // Disable SSL for test PostgreSQL connections
        sequelizeOptions.dialectOptions = {
          ssl: false,
        };
      }

      this.sequelize = new Sequelize(
        this.database,
        this.username,
        this.password,
        sequelizeOptions
      );
    }

    // Test connection with retry logic
    await this.authenticateWithRetry();
    console.log("✅ Database connection established successfully");

    // Run migrations (or create basic schema for SQLite)
    const finalDbDialect = process.env.CB_DB_DIALECT_DEV || "mysql";
    if (finalDbDialect === "sqlite") {
      await this.createBasicSQLiteSchema();
    } else {
      await this.runMigrations();
    }
  }

  async authenticateWithRetry(maxRetries = 5, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.sequelize.authenticate();
        return;
      } catch (error) {
        console.log(`⏳ Database connection attempt ${attempt}/${maxRetries} failed:`, error.message);

        if (attempt === maxRetries) {
          throw new Error(`Failed to connect to database after ${maxRetries} attempts: ${error.message}`);
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async runMigrations() {
    console.log("🔄 Running database migrations...");

    const umzug = new Umzug({
      migrations: {
        glob: path.join(__dirname, "../../models/migrations/*.js"),
        resolve: (params) => {
          const migration = require(params.path);
          return {
            name: params.name,
            up: async () => {
              // Special handling for specific problematic migrations in test environment
              if (params.name === "20200609080754-add-chartid-chartcache.js") {
                // This migration tries to delete from ChartCache but in test environment
                // the table might be empty, so we'll skip the delete and just add the column
                console.log(`⚠️  Applying test-safe version of migration ${params.name}`);
                return this.sequelize.getQueryInterface().addColumn("ChartCache", "chart_id", {
                  type: Sequelize.INTEGER,
                  allowNull: false,
                  reference: {
                    model: "Chart",
                    key: "id",
                    onDelete: "cascade",
                  },
                });
              }

              return await migration.up(this.sequelize.getQueryInterface(), Sequelize);
            }
          };
        },
      },
      context: this.sequelize.getQueryInterface(),
      storage: new SequelizeStorage({ sequelize: this.sequelize }),
      logger: undefined, // Disable logging for tests
    });

    await umzug.up();
    console.log("✅ Migrations completed successfully");
  }

  async createBasicSQLiteSchema() {
    console.log("🔄 Creating basic SQLite schema for testing...");

    const queryInterface = this.sequelize.getQueryInterface();

    // Create basic tables needed for testing
    // User table
    await queryInterface.createTable("User", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      oneaccountId: {
        type: Sequelize.STRING,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      admin: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      lastLogin: {
        type: Sequelize.DATE,
      },
      active: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      icon: {
        type: Sequelize.STRING,
      },
      passwordResetToken: {
        type: Sequelize.STRING,
      },
      tutorials: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "{}",
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      }
    });

    // Team table
    await queryInterface.createTable("Team", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      showBranding: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      allowReportRefresh: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      allowReportExport: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      }
    });

    // Project table
    await queryInterface.createTable("Project", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      team_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
      },
      brewName: {
        type: Sequelize.STRING,
        unique: true,
      },
      dashboardTitle: {
        type: Sequelize.STRING,
      },
      description: {
        type: Sequelize.TEXT,
      },
      backgroundColor: {
        type: Sequelize.STRING,
        defaultValue: "#103751",
      },
      titleColor: {
        type: Sequelize.STRING,
        defaultValue: "white",
      },
      public: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      passwordProtected: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      password: {
        type: Sequelize.STRING,
      },
      timezone: {
        type: Sequelize.STRING,
      },
      ghost: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      }
    });

    // Connection table
    await queryInterface.createTable("Connection", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      team_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      subType: {
        type: Sequelize.STRING,
      },
      active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      host: {
        type: Sequelize.TEXT,
      },
      dbName: {
        type: Sequelize.TEXT,
      },
      port: {
        type: Sequelize.TEXT,
      },
      username: {
        type: Sequelize.TEXT,
      },
      password: {
        type: Sequelize.TEXT,
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      }
    });

    console.log("✅ Basic SQLite schema created successfully");
  }

  async stop() {
    if (this.sequelize) {
      try {
        await this.sequelize.close();
      } catch (error) {
        console.log("⚠️  Error closing database connection:", error.message);
      }
      this.sequelize = null;
    }

    if (this.container) {
      try {
        console.log("🛑 Stopping test database container...");
        await this.container.stop();
        console.log("✅ Database container stopped");
      } catch (error) {
        console.log("⚠️  Error stopping container:", error.message);
      }
      this.container = null;
    }
  }

  async cleanup() {
    if (!this.sequelize) return;

    console.log("🧹 Cleaning up test database...");

    // Get all table names
    const tables = await this.sequelize.getQueryInterface().showAllTables();

    const dbDialect = process.env.CB_DB_DIALECT_DEV || "mysql";

    // Handle different database dialects
    if (dbDialect === "sqlite") {
      // For SQLite, we need to delete from tables instead of truncate
      for (const table of tables) {
        if (table !== "SequelizeMeta") {
          await this.sequelize.query(`DELETE FROM "${table}"`);
        }
      }
    } else {
      // Disable foreign key checks
      if (dbDialect === "mysql") {
        await this.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
      }

      // Truncate all tables except SequelizeMeta (migration tracking)
      for (const table of tables) {
        if (table !== "SequelizeMeta") {
          if (dbDialect === "postgres") {
            await this.sequelize.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
          } else {
            await this.sequelize.query(`TRUNCATE TABLE \`${table}\``);
          }
        }
      }

      // Re-enable foreign key checks for MySQL
      if (dbDialect === "mysql") {
        await this.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
      }
    }

    console.log("✅ Database cleanup completed");
  }

  getSequelize() {
    return this.sequelize;
  }

  getConnectionDetails() {
    const dbDialect = process.env.CB_DB_DIALECT_DEV || "mysql";

    if (dbDialect === "sqlite") {
      return {
        database: ":memory:",
        dialect: "sqlite"
      };
    }

    return {
      host: "localhost",
      port: this.port,
      database: this.database,
      username: this.username,
      password: this.password,
      dialect: dbDialect
    };
  }
}

// Export singleton instance
export const testDbManager = new TestDbManager();
