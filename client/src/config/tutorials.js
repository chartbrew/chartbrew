import compareVersions, { compare } from "compare-versions";

export default function showTutorial(type, userData) {
  if (!userData || !userData[type]) return true;

  switch (type) {
    case "addchart":
      if (userData[type] && compareVersions(userData[type], "1.0.0-beta.8.1") < 0) {
        return true;
      }
      break;
    case "dataset":
      if (userData[type] && compareVersions(userData[type], "1.0.0-beta.8.1") < 0) {
        return true;
      }
      break;
    default:
      break;
  }

  return false;
}
