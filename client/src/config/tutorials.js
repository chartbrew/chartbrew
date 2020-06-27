import compareVersions, { compare } from "compare-versions";

export default function showTutorial(type, userData) {
  console.log("type", type);
  console.log("userData", userData);
  if (!userData || !userData[type]) return true;

  switch (type) {
    case "addchart":
      if (userData[type] && compareVersions(userData[type], "1.0.0-beta.8.1") < 0) {
        return true;
      }
      break;
    case "dataset":
      console.log("compareVersions(userData[type]", compareVersions(userData[type], "1.0.0-beta.8.1"));

      if (userData[type] && compareVersions(userData[type], "1.0.0-beta.8.1") < 0) {
        return true;
      }
    default:
      break;
  }

  return false;
}
