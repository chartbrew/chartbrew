const Sequelize = require("sequelize");

function hasTable(tables, tableName) {
  return tables.some((table) => {
    if (typeof table === "string") return table === tableName;
    return table.tableName === tableName || table.table_name === tableName;
  });
}

async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  const columns = await queryInterface.describeTable(tableName);
  if (!columns[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
}

async function addIndexIfMissing(queryInterface, tableName, fields, options) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((index) => index.name === options.name)) {
    await queryInterface.addIndex(tableName, fields, options);
  }
}

async function removeColumnIfPresent(queryInterface, tableName, columnName) {
  const columns = await queryInterface.describeTable(tableName);
  if (columns[columnName]) await queryInterface.removeColumn(tableName, columnName);
}

module.exports = {
  async up(queryInterface) {
    await addColumnIfMissing(queryInterface, "MetricMonitor", "publication_policy", {
      type: Sequelize.TEXT("long"),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, "MetricMonitor", "last_evaluated_period_end", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, "MetricMonitor", "next_evaluation_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, "MetricSnapshot", "coverage", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "unknown",
    });
    await addColumnIfMissing(queryInterface, "MetricSnapshot", "result_as_of", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    const tables = await queryInterface.showAllTables();
    if (!hasTable(tables, "MetricEvaluation")) {
      await queryInterface.createTable("MetricEvaluation", {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        monitor_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: "MetricMonitor", key: "id" },
          onDelete: "CASCADE",
        },
        team_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "Team", key: "id" },
          onDelete: "CASCADE",
        },
        definition_fingerprint: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        policy_version: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        evaluation_key: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        comparison_rule: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: "previous_period",
        },
        comparison_period: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        period_mode: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: "completed",
        },
        calendar_timezone: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        week_starts_on: Sequelize.INTEGER,
        metric_behavior: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        current_period_start: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        current_period_end: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        comparison_period_start: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        comparison_period_end: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        current_value: Sequelize.DOUBLE,
        baseline_value: Sequelize.DOUBLE,
        absolute_delta: Sequelize.DOUBLE,
        relative_delta: Sequelize.DOUBLE,
        completeness: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 0,
        },
        source_bucket_count: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        source_checkpoint_count: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        publication_threshold_type: Sequelize.STRING,
        publication_threshold_value: Sequelize.DOUBLE,
        passes_threshold: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        readiness: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: "eligible",
        },
        finality: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: "settling",
        },
        revision: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        evidence: {
          type: Sequelize.TEXT("long"),
          allowNull: false,
        },
        evaluated_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        finalized_at: Sequelize.DATE,
        corrected_at: Sequelize.DATE,
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
      "MetricEvaluation",
      ["monitor_id", "evaluation_key", "revision"],
      { name: "metric_evaluation_revision_unique", unique: true }
    );
    await addIndexIfMissing(
      queryInterface,
      "MetricEvaluation",
      ["monitor_id", "current_period_end"],
      { name: "metric_evaluation_monitor_period" }
    );
    await addIndexIfMissing(
      queryInterface,
      "MetricEvaluation",
      ["team_id", "evaluated_at"],
      { name: "metric_evaluation_team_evaluated" }
    );
    await addIndexIfMissing(
      queryInterface,
      "MetricEvaluation",
      ["current_period_end"],
      { name: "metric_evaluation_period_end" }
    );
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (hasTable(tables, "MetricEvaluation")) {
      await queryInterface.dropTable("MetricEvaluation");
    }
    if (hasTable(tables, "MetricSnapshot")) {
      await removeColumnIfPresent(queryInterface, "MetricSnapshot", "result_as_of");
      await removeColumnIfPresent(queryInterface, "MetricSnapshot", "coverage");
    }
    if (hasTable(tables, "MetricMonitor")) {
      await removeColumnIfPresent(queryInterface, "MetricMonitor", "next_evaluation_at");
      await removeColumnIfPresent(queryInterface, "MetricMonitor", "last_evaluated_period_end");
      await removeColumnIfPresent(queryInterface, "MetricMonitor", "publication_policy");
    }
  },
};
