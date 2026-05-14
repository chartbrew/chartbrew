import postgresLogo from "./assets/postgres.png";
import postgresDarkLogo from "./assets/postgres-dark.png";

const postgresSource = {
  id: "postgres",
  type: "postgres",
  subType: "postgres",
  name: "PostgreSQL",
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
