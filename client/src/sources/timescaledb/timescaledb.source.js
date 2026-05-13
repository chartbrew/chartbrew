import lightLogo from "./assets/timescale-light.webp";
import darkLogo from "./assets/timescale-dark.webp";

export default {
  id: "timescaledb",
  dependsOn: ["postgres"],
  type: "postgres",
  subType: "timescaledb",
  name: "Timescale",
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
