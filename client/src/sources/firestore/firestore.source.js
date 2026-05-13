import firestoreLogo from "./assets/firestore-light.webp";
import firestoreDarkLogo from "./assets/firestore-dark.webp";

const firestoreSource = {
  id: "firestore",
  type: "firestore",
  subType: "firestore",
  name: "Firestore",
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
