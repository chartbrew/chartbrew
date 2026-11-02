const { teamRoles } = require("../../shared/roles.json");

function normalizeRoleAccess(role, data) {
  if (teamRoles.includes(role)) return { ...data, projects: [], canExport: true };
  return data;
}

module.exports = { normalizeRoleAccess };
