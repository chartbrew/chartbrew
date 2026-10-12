import mongoLogo from "./assets/logo-light.svg";
import mongoDarkLogo from "./assets/logo-dark.svg";

const mongodbSource = {
  id: "mongodb",
  type: "mongodb",
  subType: "mongodb",
  name: "MongoDB",
  description: "Build charts from documents and collections.",
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
    lightLogo: mongoLogo,
    darkLogo: mongoDarkLogo,
  },
};

export default mongodbSource;
