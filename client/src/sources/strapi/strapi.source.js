import strapiLogo from "./assets/strapi-connection.webp";
import strapiDarkLogo from "./assets/Strapi-dark.png";

const strapiSource = {
  id: "strapi",
  type: "api",
  subType: "strapi",
  name: "Strapi",
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
