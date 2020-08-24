import compareVersions from "compare-versions";

export default function showTutorial(type, userData) {
  if (!userData || !userData[type]) return true;

  switch (type) {
    case "addchart":
      console.log("compare", compareVersions(userData[type], "1.0.0-beta.8.1"));
      if (userData[type] && compareVersions(userData[type], "1.0.0-beta.8.1") < 0) {
        return true;
      }
      break;
    case "dataset":
      if (userData[type] && compareVersions(userData[type], "1.0.0-beta.8.1") < 0) {
        return true;
      }
      break;
    case "apibuilder":
      if (userData[type] && compareVersions(userData[type], "1.0.0-beta.8.1") < 0) {
        return true;
      }
      break;
    case "mongobuilder":
      if (userData[type] && compareVersions(userData[type], "1.0.0-beta.8.1") < 0) {
        return true;
      }
      break;
    case "sqlbuilder":
      if (userData[type] && compareVersions(userData[type], "1.0.0-beta.8.1") < 0) {
        return true;
      }
      break;
    case "objectexplorer":
      if (userData[type] && compareVersions(userData[type], "1.0.0-beta.8.1") < 0) {
        return true;
      }
      break;
    case "requestmodal":
      if (userData[type] && compareVersions(userData[type], "1.0.0-beta.8.1") < 0) {
        return true;
      }
      break;
    default:
      break;
  }

  return false;
}
