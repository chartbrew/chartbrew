import strapiLogo from "./assets/logo-light.svg";
import strapiDarkLogo from "./assets/logo-dark.svg";

const strapiSource = {
  id: "strapi",
  type: "api",
  subType: "strapi",
  name: "Strapi",
  description: "Build charts from your content collections.",
  category: "api",
  capabilities: {
    ai: {
      canGenerateDatasets: false,
      canGenerateQueries: false,
      hasSourceInstructions: false,
      hasTools: false,
    },
    templates: { dashboards: true },
  },
  assets: {
    lightLogo: strapiLogo,
    darkLogo: strapiDarkLogo,
  },
};

export default strapiSource;
