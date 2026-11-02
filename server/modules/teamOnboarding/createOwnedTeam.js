const { nanoid } = require("nanoid");

const db = require("../../models/models");
const { sanitizeTeamName, sanitizeUseCases } = require("./businessProfile");

async function createOwnedTeam({
  canExport = false,
  dashboardName = "First Dashboard",
  name,
  transaction,
  useCases,
  userId,
}) {
  const teamValues = {
    name: sanitizeTeamName(name),
    onboardingCompletedAt: null,
  };
  if (useCases !== undefined && useCases !== null && String(useCases).trim()) {
    teamValues.useCases = sanitizeUseCases(useCases);
  }
  const team = await db.Team.create(teamValues, { transaction });
  await db.TeamRole.create({
    team_id: team.id,
    user_id: userId,
    role: "teamOwner",
    canExport,
  }, { transaction });
  await db.Project.create({
    team_id: team.id,
    name: "Ghost Project",
    brewName: `ghost-project-${nanoid(8)}`,
    dashboardTitle: "Ghost Project",
    ghost: true,
    public: false,
  }, { transaction });
  await db.Project.create({
    team_id: team.id,
    name: dashboardName,
    brewName: `${dashboardName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${nanoid(8)}`,
    dashboardTitle: dashboardName,
    description: `${dashboardName} for ${team.name}`,
    public: false,
  }, { transaction });
  return team;
}

module.exports = createOwnedTeam;
