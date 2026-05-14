import lightLogo from "./assets/rds.png";
import darkLogo from "./assets/rds-dark.png";

export default {
  id: "rdsMysql",
  dependsOn: ["mysql"],
  type: "mysql",
  subType: "rdsMysql",
  name: "RDS MySQL",
  category: "database",
  capabilities: {
    ai: {
      canGenerateDatasets: true,
      canGenerateQueries: true,
      hasSourceInstructions: true,
      hasTools: false,
    },
  },
  assets: {
    lightLogo,
    darkLogo,
  },
};
