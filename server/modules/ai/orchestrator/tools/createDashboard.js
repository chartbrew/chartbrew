const db = require("../../../../models/models");
const ProjectController = require("../../../../controllers/ProjectController");
const { normalizeTeamId } = require("./teamScope");

const projectController = new ProjectController();
const clientUrl = process.env.NODE_ENV === "production" ? process.env.VITE_APP_CLIENT_HOST : process.env.VITE_APP_CLIENT_HOST_DEV;

async function createDashboard(payload) {
  const {
    team_id,
    user_id,
    name,
  } = payload;

  if (!team_id) {
    throw new Error("team_id is required to create a dashboard");
  }
  if (!user_id) {
    throw new Error("user_id is required to create a dashboard");
  }
  if (!name) {
    throw new Error("name is required to create a dashboard");
  }

  const normalizedTeamId = normalizeTeamId(team_id);
  const teamRole = await db.TeamRole.findOne({
    where: { team_id: normalizedTeamId, user_id },
  });

  if (!teamRole) {
    throw new Error("User does not belong to the specified team");
  }

  const project = await projectController.create(Number(user_id), {
    team_id: normalizedTeamId,
    name,
    ghost: false,
  });

  return {
    status: "ok",
    dashboard_created: true,
    project_id: project.id,
    name: project.name,
    dashboard_url: `${clientUrl}/dashboard/${project.id}`,
  };
}

module.exports = createDashboard;
