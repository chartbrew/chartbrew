import lightLogo from "../rdspostgres/assets/logo-light.png";
import darkLogo from "../rdspostgres/assets/logo-light.png";

export default {
  id: "rdsMysql",
  dependsOn: ["mysql"],
  type: "mysql",
  subType: "rdsMysql",
  name: "RDS MySQL",
  description: "Query MySQL data hosted on Amazon RDS.",
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
