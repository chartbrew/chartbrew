import mongoLogo from "./assets/mongodb-logo.png";
import mongoDarkLogo from "./assets/mongodb-dark.png";

const mongodbSource = {
  id: "mongodb",
  type: "mongodb",
  subType: "mongodb",
  name: "MongoDB",
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
