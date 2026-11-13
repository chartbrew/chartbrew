const jwt = require("jsonwebtoken");
const db = require("../models/models");
const settings = require("../settings");
const { teamRoles } = require("../../shared/roles.json");
const { verifyProjectPassword } = require("./projectPassword");
const { verifyShareToken, validateShareTokenPolicy } = require("./shareToken");

const accessError = (status, message) => Object.assign(new Error(message), { status });

async function resolvePublicDashboardAccess({ brewName, password, queryParams = {}, user, report = false }) {
  const project = await db.Project.findOne({ where: { brewName } });
  if (!project) throw accessError(404, "Dashboard not found");

  if (user?.id) {
    const role = await db.TeamRole.findOne({ where: { team_id: project.team_id, user_id: user.id } });
    if (role && (teamRoles.includes(role.role) || role.projects?.some((id) => String(id) === String(project.id)))) {
      return { project, member: true, policy: null };
    }
  }

  if (!report && queryParams.accessToken) {
    try {
      const token = jwt.verify(queryParams.accessToken, settings.encryptionKey);
      if (token.project_id === project.id) return { project, member: false, policy: null };
    } catch {
      // An invalid internal token must still pass the normal public access checks.
    }
  }

  if (!project.public) throw accessError(401, "Not authorized");
  let policy;
  if (report) {
    try {
      const token = verifyShareToken(queryParams.token);
      policy = await db.SharePolicy.findByPk(token?.sub?.sharePolicyId);
      validateShareTokenPolicy(token, policy, "Project", project.id);
    } catch (error) {
      throw accessError(error.message === "Share policy is disabled" ? 403 : 401, "Not authorized");
    }
  } else {
    policy = await db.SharePolicy.findOne({ where: { entity_type: "Project", entity_id: project.id } });
    if (policy?.visibility === "disabled") throw accessError(403, "Not authorized");
    if (policy?.expires_at && new Date(policy.expires_at).getTime() <= Date.now()) throw accessError(401, "Not authorized");
    if (policy && policy.visibility !== "public") {
      if (queryParams.token) {
        try {
          validateShareTokenPolicy(verifyShareToken(queryParams.token), policy, "Project", project.id);
        } catch {
          throw accessError(401, "Not authorized");
        }
      } else if (!project.passwordProtected || !await verifyProjectPassword(password, project.password)) {
        throw accessError(401, "Access token required");
      }
    }
  }

  if (project.passwordProtected && !await verifyProjectPassword(password, project.password)) {
    throw accessError(403, "Enter the correct password");
  }
  return { project, member: false, policy };
}

module.exports = { resolvePublicDashboardAccess };
