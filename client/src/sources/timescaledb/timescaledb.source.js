import lightLogo from "./assets/logo-light.png";
import darkLogo from "./assets/logo-dark.svg";

export default {
  id: "timescaledb",
  dependsOn: ["postgres"],
  type: "postgres",
  subType: "timescaledb",
  name: "Timescale",
  description: "Query time series data with PostgreSQL.",
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
