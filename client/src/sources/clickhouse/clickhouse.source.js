import clickhouseLogo from "./assets/logo-light.svg";
import clickhouseDarkLogo from "./assets/logo-dark.svg";

const clickhouseSource = {
  id: "clickhouse",
  type: "clickhouse",
  subType: "clickhouse",
  name: "ClickHouse",
  description: "Analyze large datasets with fast SQL queries.",
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
    lightLogo: clickhouseLogo,
    darkLogo: clickhouseDarkLogo,
  },
};

export default clickhouseSource;
