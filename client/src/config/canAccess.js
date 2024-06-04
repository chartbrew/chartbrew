/*
** this is used to improve the UX. The real role check is done in the backend
*/
export default function canAccess(role, userId, teamRoles) {
  let teamRole = "guest";
  if (teamRoles) {
    for (let i = 0; i < teamRoles.length; i++) {
      if (teamRoles[i].user_id === userId) {
        teamRole = teamRoles[i].role;
        break;
      }
    }
  }

  switch (role) {
    case "teamOwner":
      if (teamRole === "teamOwner") return true;
      break;
    case "teamAdmin":
      if (teamRole === "teamOwner" || teamRole === "teamAdmin") return true;
      break;
    case "projectAdmin":
      if (teamRole === "teamOwner" || teamRole === "teamAdmin" || teamRole === "projectAdmin") return true;
      break;
    case "projectEditor":
      if (teamRole === "teamOwner" || teamRole === "teamAdmin" || teamRole === "projectAdmin" || teamRole === "projectEditor") return true;
      break;
    case "projectViewer":
      if (teamRole === "teamOwner" || teamRole === "teamAdmin" || teamRole === "projectAdmin" || teamRole === "projectEditor" || teamRole === "projectViewer") return true;
      break;
    default:
      return false;
  }

  return false;
}
