import stripeLogo from "../stripe/assets/stripe-connection.webp";
import stripeDarkLogo from "../stripe/assets/stripe-dark.png";

const DEFAULT_CONFIGURATION = {
  source: "stripeOfficial",
  resource: "balance_transactions",
  mode: "aggregate",
  metric: {
    field: "net",
    operation: "sum",
  },
  dimension: {
    field: "created",
    interval: "day",
  },
  dateRange: {
    field: "created",
    start: "last_30_days",
    end: "now",
  },
  filters: [],
  expand: [],
  pagination: {
    limit: 100,
    maxRecords: 5000,
  },
  queryMode: "list",
};

const stripeOfficialSource = {
  id: "stripeOfficial",
  type: "stripeOfficial",
  subType: "stripeOfficial",
  name: "Stripe",
  category: "payments",
  showNewBadge: true,
  capabilities: {
    ai: { canGenerateQueries: false, hasSourceInstructions: true, hasTools: true, canGenerateDatasets: true },
    templates: { charts: true, datasets: true },
    nextSteps: { chartTemplates: true, datasetTemplates: true },
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
      itemsLimit: 5000,
      offset: "starting_after",
      paginationField: null,
      template: "stripeOfficial",
      useGlobalHeaders: true,
      configuration: DEFAULT_CONFIGURATION,
    },
  },
  templates: {
    chartTemplates: ["compiled-metrics", "starter-metrics"],
  },
};

export { DEFAULT_CONFIGURATION };
export default stripeOfficialSource;
