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
  moveChartToDashboard,
  disambiguate,
  sourceGetCapabilities,
  sourceGetSampleData,
  sourceListResources,
  sourceListTemplates,
  sourcePlanDataset,
  sourcePreviewConfiguration,
  sourceRecommendTemplates,
  sourceValidateConfiguration,
  stripeOfficialPlanDataset,
  stripeOfficialPreviewConfiguration,
  stripeOfficialValidateConfiguration,
};
