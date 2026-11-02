import lightLogo from "./assets/logo-light.png";
import darkLogo from "./assets/logo-light.png";

export default {
  id: "supabasedb",
  dependsOn: ["postgres"],
  type: "postgres",
  subType: "supabasedb",
  name: "Supabase DB",
  description: "Query your Supabase database tables with SQL.",
  category: "database",
  capabilities: {
    ai: {
      canGenerateDatasets: true,
      canGenerateQueries: true,
      hasSourceInstructions: true,
      hasTools: false,
    },
  },
  assets: {
    lightLogo,
    darkLogo,
  },
};
