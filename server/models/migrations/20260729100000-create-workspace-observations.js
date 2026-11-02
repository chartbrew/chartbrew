const Sequelize = require("sequelize");

function timestamps() {
  return {
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
    },
  };
}

function hasTable(tables, tableName) {
  return tables.some((table) => {
    if (typeof table === "string") return table === tableName;
    return table.tableName === tableName || table.table_name === tableName;
  });
}

async function createTableIfMissing(queryInterface, tableName, attributes) {
  const tables = await queryInterface.showAllTables();
  if (!hasTable(tables, tableName)) {
    await queryInterface.createTable(tableName, attributes);
  }
}

async function addIndexIfMissing(queryInterface, tableName, fields, options) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((index) => index.name === options.name)) {
    try {
      await queryInterface.addIndex(tableName, fields, options);
    } catch (error) {
      const isForeignKeyRenameError = error.message?.includes("Foreign key constraint is incorrectly formed");
      if (!isForeignKeyRenameError) throw error;

      const transaction = await queryInterface.sequelize.transaction();
      try {
        await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 0", { transaction });
        await queryInterface.addIndex(tableName, fields, { ...options, transaction });
        await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 1", { transaction });
        await transaction.commit();
      } catch (retryError) {
        await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 1", { transaction });
        await transaction.rollback();
        throw retryError;
      }
    }
  }
}

module.exports = {
  async up(queryInterface) {
    const aiUsageColumns = await queryInterface.describeTable("AiUsage");
    if (!aiUsageColumns.purpose) {
      await queryInterface.addColumn("AiUsage", "purpose", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    const aiUsageIndexes = await queryInterface.showIndex("AiUsage");
    if (!aiUsageIndexes.some((index) => index.name === "ai_usage_team_purpose_created")) {
      await queryInterface.addIndex("AiUsage", ["team_id", "purpose", "createdAt"], {
        name: "ai_usage_team_purpose_created",
      });
    }

    await createTableIfMissing(queryInterface, "MetricMonitor", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      team_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Team", key: "id" },
        onDelete: "CASCADE",
      },
      project_id: {
        type: Sequelize.INTEGER,
        references: { model: "Project", key: "id" },
        onDelete: "CASCADE",
      },
      chart_id: {
        type: Sequelize.INTEGER,
        references: { model: "Chart", key: "id" },
        onDelete: "CASCADE",
      },
      dataset_id: {
        type: Sequelize.INTEGER,
        references: { model: "Dataset", key: "id" },
        onDelete: "CASCADE",
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "User", key: "id" },
        onDelete: "SET NULL",
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      kind: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      binding_key: Sequelize.STRING,
      metric_spec: {
        type: Sequelize.TEXT("long"),
        allowNull: false,
      },
      baseline_policy: {
        type: Sequelize.TEXT("long"),
        allowNull: false,
      },
      cadence: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "after_refresh",
      },
      importance: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "collecting",
      },
      status_reason: Sequelize.STRING,
      minimum_samples: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 7,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      definition_fingerprint: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      last_sampled_at: Sequelize.DATE,
      ...timestamps(),
    });
    await addIndexIfMissing(queryInterface, "MetricMonitor", ["team_id", "is_active", "status"], {
      name: "metric_monitor_team_active_status",
    });
    await addIndexIfMissing(queryInterface, "MetricMonitor", ["chart_id", "is_active"], {
      name: "metric_monitor_chart_active",
    });
    await addIndexIfMissing(queryInterface, "MetricMonitor", ["dataset_id", "is_active"], {
      name: "metric_monitor_dataset_active",
    });
    await addIndexIfMissing(queryInterface, "MetricMonitor", ["team_id", "chart_id", "binding_key"], {
      unique: true,
      name: "metric_monitor_chart_binding_unique",
    });

    await createTableIfMissing(queryInterface, "MetricSnapshot", {
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
      update_run_id: {
        type: Sequelize.INTEGER,
        references: { model: "UpdateRun", key: "id" },
        onDelete: "SET NULL",
      },
      period_start: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      period_end: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      granularity: {
        type: Sequelize.STRING(32),
        allowNull: false,
      },
      rollup: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: "raw",
      },
      value: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      sample_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      completeness: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 1,
      },
      definition_fingerprint: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      ...timestamps(),
    });
    await addIndexIfMissing(queryInterface, "MetricSnapshot", [
      "monitor_id",
      "definition_fingerprint",
      "period_start",
      "period_end",
      "granularity",
      "rollup",
    ], {
      unique: true,
      name: "metric_snapshot_period_unique",
    });
    await addIndexIfMissing(queryInterface, "MetricSnapshot", ["monitor_id", "period_end"], {
      name: "metric_snapshot_monitor_period",
    });
    await addIndexIfMissing(queryInterface, "MetricSnapshot", ["team_id", "period_end"], {
      name: "metric_snapshot_team_period",
    });
    await addIndexIfMissing(queryInterface, "MetricSnapshot", ["period_end"], {
      name: "metric_snapshot_period_end",
    });

    await createTableIfMissing(queryInterface, "Observation", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      team_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Team", key: "id" },
        onDelete: "CASCADE",
      },
      project_id: {
        type: Sequelize.INTEGER,
        references: { model: "Project", key: "id" },
        onDelete: "SET NULL",
      },
      chart_id: {
        type: Sequelize.INTEGER,
        references: { model: "Chart", key: "id" },
        onDelete: "SET NULL",
      },
      dataset_id: {
        type: Sequelize.INTEGER,
        references: { model: "Dataset", key: "id" },
        onDelete: "SET NULL",
      },
      monitor_id: {
        type: Sequelize.UUID,
        references: { model: "MetricMonitor", key: "id" },
        onDelete: "SET NULL",
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "metric_change",
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "open",
      },
      severity: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      confidence: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      score: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      direction: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      deduplication_key: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      summary: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      current_value: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      baseline_value: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      absolute_delta: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      relative_delta: Sequelize.DOUBLE,
      unit: Sequelize.STRING,
      current_period_start: Sequelize.DATE,
      current_period_end: Sequelize.DATE,
      comparison_period_start: Sequelize.DATE,
      comparison_period_end: Sequelize.DATE,
      evidence: {
        type: Sequelize.TEXT("long"),
        allowNull: false,
      },
      first_detected_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      last_detected_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      opened_at: Sequelize.DATE,
      resolved_at: Sequelize.DATE,
      definition_fingerprint: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      score_version: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      evidence_revision: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      ...timestamps(),
    });
    await addIndexIfMissing(queryInterface, "Observation", ["team_id", "deduplication_key"], {
      unique: true,
      name: "observation_team_dedup_unique",
    });
    await addIndexIfMissing(queryInterface, "Observation", ["team_id", "status", "last_detected_at"], {
      name: "observation_team_status_detected",
    });
    await addIndexIfMissing(queryInterface, "Observation", ["project_id", "status", "last_detected_at"], {
      name: "observation_project_status_detected",
    });
    await addIndexIfMissing(queryInterface, "Observation", ["monitor_id", "last_detected_at"], {
      name: "observation_monitor_detected",
    });
    await addIndexIfMissing(queryInterface, "Observation", ["resolved_at"], {
      name: "observation_resolved_at",
    });

    await createTableIfMissing(queryInterface, "ObservationPreference", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      observation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Observation", key: "id" },
        onDelete: "CASCADE",
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "User", key: "id" },
        onDelete: "CASCADE",
      },
      read_at: Sequelize.DATE,
      saved_at: Sequelize.DATE,
      dismissed_at: Sequelize.DATE,
      snoozed_until: Sequelize.DATE,
      ...timestamps(),
    });
    await addIndexIfMissing(queryInterface, "ObservationPreference", ["observation_id", "user_id"], {
      unique: true,
      name: "observation_preference_user_unique",
    });
    await addIndexIfMissing(queryInterface, "ObservationPreference", ["user_id", "read_at"], {
      name: "observation_preference_user_read",
    });
    await addIndexIfMissing(queryInterface, "ObservationPreference", ["user_id", "saved_at"], {
      name: "observation_preference_user_saved",
    });

    await createTableIfMissing(queryInterface, "ObservationFeedback", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      observation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Observation", key: "id" },
        onDelete: "CASCADE",
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "User", key: "id" },
        onDelete: "CASCADE",
      },
      verdict: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      reason_code: Sequelize.STRING,
      ...timestamps(),
    });
    await addIndexIfMissing(queryInterface, "ObservationFeedback", ["observation_id", "user_id"], {
      unique: true,
      name: "observation_feedback_user_unique",
    });
    await addIndexIfMissing(queryInterface, "ObservationFeedback", ["observation_id", "verdict"], {
      name: "observation_feedback_verdict",
    });

    await createTableIfMissing(queryInterface, "ObservationAudit", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      observation_id: {
        type: Sequelize.UUID,
        references: { model: "Observation", key: "id" },
        onDelete: "CASCADE",
      },
      team_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Team", key: "id" },
        onDelete: "CASCADE",
      },
      candidate_fingerprint: Sequelize.STRING,
      audit_mode: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      model: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      audit_version: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      verdict: {
        type: Sequelize.TEXT("long"),
        allowNull: false,
      },
      feature_vector: {
        type: Sequelize.TEXT("long"),
        allowNull: false,
      },
      usage_id: Sequelize.UUID,
      ...timestamps(),
    });
    await addIndexIfMissing(queryInterface, "ObservationAudit", ["team_id", "createdAt"], {
      name: "observation_audit_team_created",
    });
    await addIndexIfMissing(queryInterface, "ObservationAudit", ["observation_id"], {
      name: "observation_audit_observation",
    });
    await addIndexIfMissing(queryInterface, "ObservationAudit", ["createdAt"], {
      name: "observation_audit_created_at",
    });

    await createTableIfMissing(queryInterface, "ObservationDigestSubscription", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      team_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Team", key: "id" },
        onDelete: "CASCADE",
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "User", key: "id" },
        onDelete: "CASCADE",
      },
      project_id: {
        type: Sequelize.INTEGER,
        references: { model: "Project", key: "id" },
        onDelete: "CASCADE",
      },
      monitor_id: {
        type: Sequelize.UUID,
        references: { model: "MetricMonitor", key: "id" },
        onDelete: "CASCADE",
      },
      cadence: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      timezone: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      local_delivery_time: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      channel: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "email",
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      last_delivered_at: Sequelize.DATE,
      last_noop_at: Sequelize.DATE,
      ...timestamps(),
    });
    await addIndexIfMissing(queryInterface, "ObservationDigestSubscription", ["user_id", "enabled"], {
      name: "observation_digest_user_enabled",
    });
    await addIndexIfMissing(queryInterface, "ObservationDigestSubscription", ["team_id", "enabled", "cadence"], {
      name: "observation_digest_team_cadence",
    });

    await createTableIfMissing(queryInterface, "AiConversationContext", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "AiConversation", key: "id" },
        onDelete: "CASCADE",
      },
      entity_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      entity_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      team_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Team", key: "id" },
        onDelete: "CASCADE",
      },
      ...timestamps(),
    });
    await addIndexIfMissing(queryInterface, "AiConversationContext", [
      "conversation_id",
      "entity_type",
      "entity_id",
    ], {
      unique: true,
      name: "ai_conversation_context_unique",
    });
    await addIndexIfMissing(queryInterface, "AiConversationContext", ["team_id", "entity_type", "entity_id"], {
      name: "ai_conversation_context_entity",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("AiConversationContext");
    await queryInterface.dropTable("ObservationDigestSubscription");
    await queryInterface.dropTable("ObservationAudit");
    await queryInterface.dropTable("ObservationFeedback");
    await queryInterface.dropTable("ObservationPreference");
    await queryInterface.dropTable("Observation");
    await queryInterface.dropTable("MetricSnapshot");
    await queryInterface.dropTable("MetricMonitor");
    const aiUsageIndexes = await queryInterface.showIndex("AiUsage");
    if (aiUsageIndexes.some((index) => index.name === "ai_usage_team_purpose_created")) {
      await queryInterface.removeIndex("AiUsage", "ai_usage_team_purpose_created");
    }
    const aiUsageColumns = await queryInterface.describeTable("AiUsage");
    if (aiUsageColumns.purpose) {
      await queryInterface.removeColumn("AiUsage", "purpose");
    }
  },
};
