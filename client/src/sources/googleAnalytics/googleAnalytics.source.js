import gAnalyticsLogo from "./assets/GoogleAnalytics.webp";
import googleanalyticsDarkLogo from "./assets/googleanalytics-dark.png";

const googleAnalyticsSource = {
  id: "googleAnalytics",
  type: "googleAnalytics",
  subType: "googleAnalytics",
  name: "Google Analytics",
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
