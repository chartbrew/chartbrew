import lightLogo from "./assets/supabase-connection.webp";
import darkLogo from "./assets/Supabase-dark.png";

export default {
  id: "supabasedb",
  dependsOn: ["postgres"],
  type: "postgres",
  subType: "supabasedb",
  name: "Supabase DB",
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
