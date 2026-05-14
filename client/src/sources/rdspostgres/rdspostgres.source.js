import lightLogo from "./assets/rds.png";
import darkLogo from "./assets/rds-dark.png";

export default {
  id: "rdsPostgres",
  dependsOn: ["postgres"],
  type: "postgres",
  subType: "rdsPostgres",
  name: "RDS Postgres",
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
