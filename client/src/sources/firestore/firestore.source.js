import firestoreLogo from "./assets/logo-light.svg";
import firestoreDarkLogo from "./assets/logo-light.svg";

const firestoreSource = {
  id: "firestore",
  type: "firestore",
  subType: "firestore",
  name: "Firestore",
  description: "Explore documents and collections from your app.",
  category: "database",
  capabilities: {
    ai: {
      canGenerateDatasets: true,
      canGenerateQueries: false,
      hasSourceInstructions: true,
      hasTools: true,
    },
  },
  assets: {
    lightLogo: firestoreLogo,
    darkLogo: firestoreDarkLogo,
  },
};

export default firestoreSource;
