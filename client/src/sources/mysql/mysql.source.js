import lightLogo from "./assets/logo-light.svg";
import darkLogo from "./assets/logo-dark.svg";

export default {
  id: "mysql",
  type: "mysql",
  subType: "mysql",
  name: "MySQL",
  description: "Build charts from MySQL tables with SQL.",
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
