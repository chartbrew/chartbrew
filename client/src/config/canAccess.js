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
    case "owner":
      if (teamRole === "owner") return true;
      break;
    case "admin":
      if (teamRole === "owner" || teamRole === "admin") return true;
      break;
    case "editor":
      if (teamRole === "owner" || teamRole === "admin" || teamRole === "editor") return true;
      break;
    case "member":
      if (teamRole === "owner" || teamRole === "admin" || teamRole === "editor" || teamRole === "member") return true;
      break;
    default:
      return false;
  }

  return false;
}
