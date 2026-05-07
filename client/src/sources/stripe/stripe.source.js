import stripeLogo from "./assets/stripe-connection.webp";
import stripeDarkLogo from "./assets/stripe-dark.png";

const stripeSource = {
  id: "stripe",
  type: "api",
  subType: "stripe",
  name: "Stripe Legacy",
  category: "payments",
  capabilities: {
    ai: { canGenerateQueries: false },
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
