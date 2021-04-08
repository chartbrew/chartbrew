import compareVersions from "compare-versions";

export default function showTutorial(type, userData) {
  if (!userData || !userData[type]) return true;

  switch (type) {
    case "addchart":
      if (userData[type] && compareVersions(userData[type], "1.0.0-beta.12") < 0) {
        return true;
      }
      break;
    case "dataset":
      if (userData[type] && compareVersions(userData[type], "1.0.0-beta.12") < 0) {
        return true;
      }
      break;
    case "apibuilder":
      if (userData[type] && compareVersions(userData[type], "1.0.0-beta.12") < 0) {
        return true;
      }
      break;
    case "mongobuilder":
      if (userData[type] && compareVersions(userData[type], "1.0.0-beta.12") < 0) {
        return true;
      }
      break;
    case "sqlbuilder":
      if (userData[type] && compareVersions(userData[type], "1.0.0-beta.12") < 0) {
        return true;
      }
      break;
    case "requestmodal":
      if (userData[type] && compareVersions(userData[type], "1.0.0-beta.12") < 0) {
        return true;
      }
      break;
    case "datasetdata":
      if (userData[type] && compareVersions(userData[type], "1.0.0-beta.12") < 0) {
        return true;
      }
      break;
    case "firestorebuilder":
      if (userData[type] && compareVersions(userData[type], "1.8.0") < 0) {
        return true;
      }
      break;
    default:
      break;
  }

  return false;
}
