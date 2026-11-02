const Sequelize = require("sequelize");

function hasTable(tables, tableName) {
  return tables.some((table) => {
    if (typeof table === "string") return table === tableName;
    return table.tableName === tableName || table.table_name === tableName;
  });
}

async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  const columns = await queryInterface.describeTable(tableName);
  if (!columns[columnName]) await queryInterface.addColumn(tableName, columnName, definition);
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
    await addColumnIfMissing(queryInterface, "Observation", "metric_evaluation_id", {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "MetricEvaluation", key: "id" },
      onDelete: "SET NULL",
    });
    await addColumnIfMissing(queryInterface, "ObservationDigestSubscription", "content_mode", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "kpi_review",
    });
    await addColumnIfMissing(queryInterface, "ObservationDigestSubscription", "day_of_month", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });
    await addColumnIfMissing(
      queryInterface,
      "ObservationDigestSubscription",
      "evaluation_wait_minutes",
      {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 120,
      }
    );

    const tables = await queryInterface.showAllTables();
    if (!hasTable(tables, "ObservationDigestDeliveryItem")) {
      await queryInterface.createTable("ObservationDigestDeliveryItem", {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        subscription_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: "ObservationDigestSubscription", key: "id" },
          onDelete: "CASCADE",
        },
        metric_evaluation_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: "MetricEvaluation", key: "id" },
          onDelete: "CASCADE",
        },
        evaluation_revision: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        delivery_attempted_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        delivered_at: Sequelize.DATE,
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: "pending",
        },
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
      "Observation",
      ["metric_evaluation_id"],
      { name: "observation_metric_evaluation_unique", unique: true }
    );
    await addIndexIfMissing(
      queryInterface,
      "ObservationDigestDeliveryItem",
      ["subscription_id", "metric_evaluation_id", "evaluation_revision"],
      { name: "observation_digest_evaluation_revision_unique", unique: true }
    );
    await addIndexIfMissing(
      queryInterface,
      "ObservationDigestDeliveryItem",
      ["metric_evaluation_id"],
      { name: "observation_digest_delivery_evaluation" }
    );
    await addIndexIfMissing(
      queryInterface,
      "ObservationDigestDeliveryItem",
      ["subscription_id", "status"],
      { name: "observation_digest_delivery_subscription_status" }
    );
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (hasTable(tables, "ObservationDigestDeliveryItem")) {
      await queryInterface.dropTable("ObservationDigestDeliveryItem");
    }
    await removeColumnIfPresent(
      queryInterface,
      "ObservationDigestSubscription",
      "evaluation_wait_minutes"
    );
    await removeColumnIfPresent(
      queryInterface,
      "ObservationDigestSubscription",
      "content_mode"
    );
    await removeColumnIfPresent(
      queryInterface,
      "ObservationDigestSubscription",
      "day_of_month"
    );
    await removeColumnIfPresent(queryInterface, "Observation", "metric_evaluation_id");
  },
};
