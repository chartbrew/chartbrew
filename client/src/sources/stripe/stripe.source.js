import stripeLogo from "./assets/logo-light.svg";
import stripeDarkLogo from "./assets/logo-light.svg";

const stripeSource = {
  id: "stripe",
  type: "api",
  subType: "stripe",
  name: "Stripe Legacy",
  description: "Build datasets with custom Stripe API requests.",
  category: "payments",
  capabilities: {
    ai: {
      canGenerateDatasets: false,
      canGenerateQueries: false,
      hasSourceInstructions: true,
      hasTools: false,
    },
    templates: { charts: true },
    nextSteps: { chartTemplates: true },
  },
  assets: {
    lightLogo: stripeLogo,
    darkLogo: stripeDarkLogo,
  },
  defaults: {
    dataRequest: {
      method: "GET",
      pagination: true,
      items: "data",
      itemsLimit: 1000,
      offset: "starting_after",
      paginationField: null,
      template: "stripe",
      useGlobalHeaders: true,
    },
  },
  templates: {
    chartTemplates: ["core-revenue"],
  },
};

export default stripeSource;
