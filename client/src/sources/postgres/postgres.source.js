import postgresLogo from "./assets/logo-light.svg";
import postgresDarkLogo from "./assets/logo-dark.svg";

const postgresSource = {
  id: "postgres",
  type: "postgres",
  subType: "postgres",
  name: "PostgreSQL",
  description: "Query tables and views with SQL.",
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
    lightLogo: postgresLogo,
    darkLogo: postgresDarkLogo,
  },
};

export default postgresSource;
