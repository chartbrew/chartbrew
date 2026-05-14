import apiLogo from "./assets/api.png";
import apiDarkLogo from "./assets/api-dark.png";

const apiSource = {
  id: "api",
  type: "api",
  name: "API",
  category: "api",
  capabilities: {
    ai: {
      canGenerateDatasets: true,
      canGenerateQueries: false,
      hasSourceInstructions: true,
      hasTools: true,
    },
  },
  assets: {
    lightLogo: apiLogo,
    darkLogo: apiDarkLogo,
  },
};

export default apiSource;
