const Sequelize = require("sequelize");

function hasTable(tables, tableName) {
  return tables.some((table) => {
    if (typeof table === "string") return table === tableName;
    return table.tableName === tableName || table.table_name === tableName;
  });
}

async function promoteFirstTeamOwner(queryInterface, transaction) {
  const queryGenerator = queryInterface.queryGenerator;
  const userTable = queryGenerator.quoteTable("User");
  const teamRoleTable = queryGenerator.quoteTable("TeamRole");
  const id = queryGenerator.quoteIdentifier("id");
  const userId = queryGenerator.quoteIdentifier("user_id");
  const role = queryGenerator.quoteIdentifier("role");

  const [users] = await queryInterface.sequelize.query(
    `SELECT ${id} FROM ${userTable} ORDER BY ${id} ASC LIMIT 1`,
    { transaction }
  );
  const firstUser = users[0];
  if (!firstUser) return;

  const [ownerRoles] = await queryInterface.sequelize.query(
    `SELECT ${userId} FROM ${teamRoleTable} WHERE ${userId} = :userId AND ${role} = :role LIMIT 1`,
    {
      replacements: { userId: firstUser.id, role: "teamOwner" },
      transaction,
    }
  );
  if (ownerRoles.length < 1) return;

  await queryInterface.bulkUpdate(
    "User",
    { admin: true },
    { id: firstUser.id },
    { transaction }
  );
}

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const tables = await queryInterface.showAllTables({ transaction });
      if (!hasTable(tables, "PlatformSetting")) {
        await queryInterface.createTable("PlatformSetting", {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
          },
          key: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true,
          },
          value: {
            type: Sequelize.TEXT("long"),
            allowNull: false,
          },
          updated_by: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: "User", key: "id" },
            onDelete: "SET NULL",
          },
          createdAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          updatedAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
        }, { transaction });
      }

      await promoteFirstTeamOwner(queryInterface, transaction);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (hasTable(tables, "PlatformSetting")) {
      await queryInterface.dropTable("PlatformSetting");
    }
  },
};
