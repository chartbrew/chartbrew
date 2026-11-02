import realtimeDbLogo from "./assets/logo-light.svg";
import realtimeDbDarkLogo from "./assets/logo-light.svg";

const realtimeDbSource = {
  id: "realtimedb",
  type: "realtimedb",
  subType: "realtimedb",
  name: "Realtime DB",
  description: "Build charts from your Firebase app data.",
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
    lightLogo: realtimeDbLogo,
    darkLogo: realtimeDbDarkLogo,
  },
};

export default realtimeDbSource;
