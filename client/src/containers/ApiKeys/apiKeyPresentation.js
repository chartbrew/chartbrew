export function isLegacyApiKey(apiKey) {
  return apiKey.dataApiAccess === "unavailable";
}

export function getPermissionLabels(apiKey) {
  if (isLegacyApiKey(apiKey)) return [];

  const permissions = ["Read data"];
  if (apiKey.permissions?.includes("data:refresh")) permissions.push("Refresh data");
  return permissions;
}

export function getProjectAccessLabel(apiKey, projects = []) {
  if (!apiKey.projectAccess) return "Existing integrations only";
  if (apiKey.projectAccess.allProjects) return "All projects in this team";

  const selectedIds = new Set(apiKey.projectAccess.projectIds || []);
  const selectedProjects = projects.filter((project) => selectedIds.has(project.id));
  if (selectedProjects.length === 1) return selectedProjects[0].name;
  return `${selectedProjects.length} projects`;
}
