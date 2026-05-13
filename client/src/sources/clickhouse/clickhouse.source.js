import clickhouseLogo from "./assets/clickhouse-light.svg";
import clickhouseDarkLogo from "./assets/clickhouse-dark.svg";

const clickhouseSource = {
  id: "clickhouse",
  type: "clickhouse",
  subType: "clickhouse",
  name: "ClickHouse",
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
