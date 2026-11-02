const Sequelize = require("sequelize");

function hasTable(tables, tableName) {
  return tables.some((table) => {
    if (typeof table === "string") return table === tableName;
    return table.tableName === tableName || table.table_name === tableName;
  });
}

async function addIndexIfMissing(queryInterface, tableName, fields, options) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((index) => index.name === options.name)) {
    await queryInterface.addIndex(tableName, fields, options);
  }
}

module.exports = {
  async up(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (!hasTable(tables, "OrchestratorActionAudit")) {
      await queryInterface.createTable("OrchestratorActionAudit", {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        action_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        team_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "Team", key: "id" },
          onDelete: "CASCADE",
        },
        project_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "Project", key: "id" },
          onDelete: "CASCADE",
        },
        actor_user_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "User", key: "id" },
          onDelete: "SET NULL",
        },
        action_type: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        authority_type: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        source: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        resource_type: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        resource_id: Sequelize.STRING,
        changed_fields: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        before_values: Sequelize.TEXT("long"),
        after_values: Sequelize.TEXT("long"),
        proposal_hash: Sequelize.STRING,
        session_binding_hash: Sequelize.STRING,
        status: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        failure_code: Sequelize.STRING,
        completed_at: Sequelize.DATE,
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    }
    await addIndexIfMissing(
      queryInterface,
      "OrchestratorActionAudit",
      ["action_id"],
      { name: "orchestrator_action_id_unique", unique: true }
    );
    await addIndexIfMissing(
      queryInterface,
      "OrchestratorActionAudit",
      ["team_id", "createdAt"],
      { name: "orchestrator_action_team_created" }
    );
    await addIndexIfMissing(
      queryInterface,
      "OrchestratorActionAudit",
      ["project_id", "createdAt"],
      { name: "orchestrator_action_project_created" }
    );
    await addIndexIfMissing(
      queryInterface,
      "OrchestratorActionAudit",
      ["actor_user_id", "createdAt"],
      { name: "orchestrator_action_actor_created" }
    );

    const usageColumns = await queryInterface.describeTable("AiUsage");
    if (!usageColumns.context_manifest) {
      await queryInterface.addColumn("AiUsage", "context_manifest", {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      });
    }
    const messageColumns = await queryInterface.describeTable("AiMessage");
    if (!messageColumns.sensitive_workspace_context) {
      await queryInterface.addColumn("AiMessage", "sensitive_workspace_context", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    if (!messageColumns.workspace_access_version) {
      await queryInterface.addColumn("AiMessage", "workspace_access_version", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const messageColumns = await queryInterface.describeTable("AiMessage");
    if (messageColumns.workspace_access_version) {
      await queryInterface.removeColumn("AiMessage", "workspace_access_version");
    }
    if (messageColumns.sensitive_workspace_context) {
      await queryInterface.removeColumn("AiMessage", "sensitive_workspace_context");
    }
    const usageColumns = await queryInterface.describeTable("AiUsage");
    if (usageColumns.context_manifest) {
      await queryInterface.removeColumn("AiUsage", "context_manifest");
    }
    const tables = await queryInterface.showAllTables();
    if (hasTable(tables, "OrchestratorActionAudit")) {
      await queryInterface.dropTable("OrchestratorActionAudit");
    }
  },
};
