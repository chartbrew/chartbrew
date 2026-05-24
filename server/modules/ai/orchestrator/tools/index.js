const listConnections = require("./listConnections");
const getSchema = require("./getSchema");
const generateQuery = require("./generateQuery");
const validateQuery = require("./validateQuery");
const runQuery = require("./runQuery");
const summarize = require("./summarize");
const suggestChart = require("./suggestChart");
const createDataset = require("./createDataset");
const createChart = require("./createChart");
const updateDataset = require("./updateDataset");
const updateChart = require("./updateChart");
const createTemporaryChart = require("./createTemporaryChart");
const createDashboard = require("./createDashboard");
const createDashboardChart = require("./createDashboardChart");
const createDashboardFromTemplate = require("./createDashboardFromTemplate");
const moveChartToDashboard = require("./moveChartToDashboard");
const disambiguate = require("./disambiguate");
const {
  sourceGetCapabilities,
  sourceGetSampleData,
  sourceListResources,
  sourceListTemplates,
  sourcePlanDataset,
  sourcePreviewConfiguration,
  sourceRecommendTemplates,
  sourceResolveContext,
  sourceRunAction,
  sourceSearchRecords,
  sourceValidateConfiguration,
} = require("./sourceTools");
const {
  stripeOfficialPlanDataset,
  stripeOfficialPreviewConfiguration,
  stripeOfficialValidateConfiguration,
} = require("./stripeOfficialTools");

// Export all tool functions
module.exports = {
  listConnections,
  getSchema,
  generateQuery,
  validateQuery,
  runQuery,
  summarize,
  suggestChart,
  createDataset,
  createChart,
  updateDataset,
  updateChart,
  createTemporaryChart,
  createDashboard,
  createDashboardChart,
  createDashboardFromTemplate,
  moveChartToDashboard,
  disambiguate,
  sourceGetCapabilities,
  sourceGetSampleData,
  sourceListResources,
  sourceListTemplates,
  sourcePlanDataset,
  sourcePreviewConfiguration,
  sourceRecommendTemplates,
  sourceResolveContext,
  sourceRunAction,
  sourceSearchRecords,
  sourceValidateConfiguration,
  stripeOfficialPlanDataset,
  stripeOfficialPreviewConfiguration,
  stripeOfficialValidateConfiguration,
};
