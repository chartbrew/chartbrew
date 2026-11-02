export function readDashboardVisits(storage, key) {
  try {
    const ids = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(ids) ? [...new Set(ids.filter((id) => typeof id === "string"))].slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function getSidebarDashboards(projects, pins, visits, teamId) {
  const dashboards = projects.filter((project) => !project.ghost && `${project.team_id}` === `${teamId}`);
  const byId = new Map(dashboards.map((project) => [`${project.id}`, project]));
  const pinned = pins.map((pin) => byId.get(`${pin.project_id}`)).filter(Boolean);
  const recent = visits.map((id) => byId.get(id)).filter(Boolean);

  return {
    dashboards,
    items: pinned.length ? pinned : (dashboards.length > 3 ? recent.slice(0, 3) : []),
    mode: pinned.length ? "Pinned" : (dashboards.length > 3 ? "Recent" : "Quick actions"),
  };
}
