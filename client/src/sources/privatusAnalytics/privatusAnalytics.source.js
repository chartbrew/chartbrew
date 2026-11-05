import privatusAnalyticsLogo from "./assets/privatus-analytics-light.svg";
import privatusAnalyticsDarkLogo from "./assets/privatus-analytics-dark.svg";

const privatusAnalyticsSource = {
  id: "privatusAnalytics",
  type: "api",
  subType: "privatusAnalytics",
  name: "Privatus Analytics",
  category: "analytics",
  capabilities: {
    ai: {
      canGenerateDatasets: false,
      canGenerateQueries: false,
      hasSourceInstructions: false,
      hasTools: false,
    },
    templates: { charts: true },
    nextSteps: { chartTemplates: true },
  },
  assets: {
    lightLogo: privatusAnalyticsLogo,
    darkLogo: privatusAnalyticsDarkLogo,
  },
  defaults: {
    dataRequest: {
      method: "GET",
      pagination: false,
      useGlobalHeaders: true,
    },
  },
  templates: {
    chartTemplates: ["site-overview"],
  },
};

export default privatusAnalyticsSource;
