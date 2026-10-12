import gAnalyticsLogo from "./assets/logo-light.png";
import googleanalyticsDarkLogo from "./assets/logo-light.png";

const googleAnalyticsSource = {
  id: "googleAnalytics",
  type: "googleAnalytics",
  subType: "googleAnalytics",
  name: "Google Analytics",
  description: "Track website traffic, events, and visitor activity.",
  category: "analytics",
  setupDescription: "Connect Google Analytics to Chartbrew to build charts from website traffic and events. Open setup, save the connection, then sign in with Google to grant access.",
  capabilities: {
    ai: {
      canGenerateDatasets: true,
      canGenerateQueries: false,
      hasSourceInstructions: true,
      hasTools: true,
    },
  },
  assets: {
    lightLogo: gAnalyticsLogo,
    darkLogo: googleanalyticsDarkLogo,
  },
};

export default googleAnalyticsSource;
