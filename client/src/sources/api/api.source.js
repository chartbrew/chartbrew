import apiLogo from "./assets/logo-light.png";
import apiDarkLogo from "./assets/logo-dark.png";

const apiSource = {
  id: "api",
  type: "api",
  name: "API",
  description: "Build datasets from REST API responses.",
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
