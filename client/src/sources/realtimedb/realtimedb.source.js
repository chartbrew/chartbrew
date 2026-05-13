import realtimeDbLogo from "./assets/rd-light.webp";
import realtimeDbDarkLogo from "./assets/rd-dark.webp";

const realtimeDbSource = {
  id: "realtimedb",
  type: "realtimedb",
  subType: "realtimedb",
  name: "Realtime DB",
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
