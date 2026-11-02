export const CHARTBREW_V6_WELCOME_TUTORIAL = "chartbrewV6Welcome";
export const CHARTBREW_V6_WELCOME_CUTOFF = "2026-10-21T00:00:00.000Z";

export function shouldShowChartbrewV6Welcome(user, team) {
  if (!user?.id || !team?.id || user.tutorials?.[CHARTBREW_V6_WELCOME_TUTORIAL]) {
    return false;
  }

  const hasTeamRole = team.TeamRoles?.some((member) => (
    member.user_id === user.id
    && ["teamOwner", "teamAdmin", "teamEditor", "teamViewer"].includes(member.role)
  ));

  return Boolean(hasTeamRole && Date.parse(user.createdAt) < Date.parse(CHARTBREW_V6_WELCOME_CUTOFF));
}
