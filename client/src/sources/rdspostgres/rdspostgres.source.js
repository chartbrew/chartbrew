import lightLogo from "./assets/logo-light.png";
import darkLogo from "./assets/logo-light.png";

export default {
  id: "rdsPostgres",
  dependsOn: ["postgres"],
  type: "postgres",
  subType: "rdsPostgres",
  name: "RDS Postgres",
  description: "Query PostgreSQL data hosted on Amazon RDS.",
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
