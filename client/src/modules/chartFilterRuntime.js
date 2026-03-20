import { getApplicableDashboardFiltersForChart } from "./dashboardFilterRuntime";
import {
  createFieldLabel,
  normalizeEditableFieldsMetadata,
} from "./datasetFieldMetadata";

function hasDefinedValue(value) {
  return value === 0 || value === false || Boolean(value);
}

function getDatasetFields(dataset = {}) {
  if (Array.isArray(dataset?.fieldsMetadata) && dataset.fieldsMetadata.length > 0) {
    return normalizeEditableFieldsMetadata(dataset.fieldsMetadata);
  }

  if (dataset?.fieldsSchema && typeof dataset.fieldsSchema === "object") {
    return Object.keys(dataset.fieldsSchema).map((fieldPath) => ({
      id: fieldPath,
      legacyPath: fieldPath,
      label: createFieldLabel(fieldPath),
      type: dataset.fieldsSchema[fieldPath] || null,
    }));
  }

  return [];
}

function resolveDatasetField(dataset = {}, fieldId = null, fieldPath = null) {
  const datasetFields = getDatasetFields(dataset);

  return datasetFields.find((field) => {
    return (
      (fieldId && `${field.id}` === `${fieldId}`)
      || (fieldId && `${field.legacyPath}` === `${fieldId}`)
      || (fieldPath && `${field.legacyPath}` === `${fieldPath}`)
      || (fieldPath && `${field.id}` === `${fieldPath}`)
    );
  }) || null;
}

function buildConditionsOptionsLookup(chart = {}) {
  const lookup = new Map();

  (chart?.conditionsOptions || []).forEach((group) => {
    (group?.conditions || []).forEach((condition) => {
      [
        condition?.id,
        condition?.bindingId,
        condition?.filterId,
        `${group?.dataset_id}:${condition?.id}`,
        `${group?.dataset_id}:${condition?.bindingId}`,
        `${group?.dataset_id}:${condition?.filterId}`,
      ]
        .filter(Boolean)
        .forEach((key) => {
          if (!lookup.has(key)) {
            lookup.set(key, condition);
          }
        });
    });
  });

  return lookup;
}

function getConditionOptionMetadata(lookup, datasetId, condition = {}) {
  const candidateKeys = [
    `${datasetId}:${condition?.id}`,
    `${datasetId}:${condition?.bindingId}`,
    `${datasetId}:${condition?.filterId}`,
    condition?.id,
    condition?.bindingId,
    condition?.filterId,
  ].filter(Boolean);

  for (let index = 0; index < candidateKeys.length; index += 1) {
    const key = candidateKeys[index];
    if (lookup.has(key)) {
      return lookup.get(key);
    }
  }

  return null;
}

function buildDatasetConditionFilter(condition = {}, dataset = {}, metadata = {}) {
  const datasetId = dataset?.id || null;
  const resolvedField = resolveDatasetField(dataset, null, condition?.field);

  return {
    ...condition,
    id: condition?.id,
    type: condition?.type || resolvedField?.type || "string",
    fieldId: resolvedField?.id || condition?.fieldId || condition?.field || "",
    field: resolvedField?.legacyPath || condition?.field || "",
    displayName: condition?.displayName || resolvedField?.label || createFieldLabel(condition?.field || ""),
    values: Array.isArray(condition?.values) && condition.values.length > 0
      ? condition.values
      : (metadata?.values || []),
    cdcId: null,
    datasetId,
    source: condition?.source || "dataset",
  };
}

function buildQuestionFilterDefinition(questionFilter = {}, dataset = {}, cdc = {}, metadata = {}) {
  const resolvedField = resolveDatasetField(
    dataset,
    questionFilter?.fieldId || null,
    metadata?.field || null,
  );
  const filterId = questionFilter?.id || metadata?.filterId || metadata?.id || null;
  const bindingId = questionFilter?.bindingId || metadata?.bindingId || filterId;

  return {
    ...questionFilter,
    id: filterId,
    bindingId,
    filterId,
    type: questionFilter?.type || resolvedField?.type || "string",
    operator: questionFilter?.operator || metadata?.operator || "is",
    fieldId: questionFilter?.fieldId || resolvedField?.id || "",
    field: resolvedField?.legacyPath || metadata?.field || questionFilter?.fieldId || "",
    displayName: questionFilter?.label || resolvedField?.label || createFieldLabel(questionFilter?.fieldId || metadata?.field || ""),
    values: Array.isArray(metadata?.values) ? metadata.values : [],
    cdcId: cdc?.id || null,
    datasetId: dataset?.id || cdc?.dataset_id || null,
    source: "v2_question",
    valueSource: questionFilter?.valueSource || "chartFilter",
  };
}

export function getExposedChartFilters(chart = {}) {
  const lookup = buildConditionsOptionsLookup(chart);
  const exposedFilters = [];

  (chart?.ChartDatasetConfigs || []).forEach((cdc) => {
    const dataset = cdc?.Dataset || {};
    const datasetId = dataset?.id || cdc?.dataset_id || null;

    (dataset?.conditions || []).forEach((condition) => {
      if (condition?.exposed !== true) {
        return;
      }

      exposedFilters.push({
        ...buildDatasetConditionFilter(
          condition,
          dataset,
          getConditionOptionMetadata(lookup, datasetId, condition),
        ),
        Dataset: dataset,
      });
    });

    const questionFilters = Array.isArray(cdc?.vizConfig?.filters) ? cdc.vizConfig.filters : [];
    questionFilters.forEach((questionFilter) => {
      if (questionFilter?.exposed !== true) {
        return;
      }

      exposedFilters.push({
        ...buildQuestionFilterDefinition(
          questionFilter,
          dataset,
          cdc,
          getConditionOptionMetadata(lookup, datasetId, {
            id: questionFilter?.id,
            bindingId: questionFilter?.bindingId,
            filterId: questionFilter?.id,
          }),
        ),
        Dataset: dataset,
      });
    });
  });

  return exposedFilters;
}

export function countExposedChartFilters(chart = {}) {
  return getExposedChartFilters(chart).length;
}

export function upsertChartCondition(conditions = [], condition = {}) {
  const normalizedConditions = Array.isArray(conditions) ? [...conditions] : [];
  const conditionIndex = normalizedConditions.findIndex((currentCondition) => currentCondition?.id === condition?.id);

  if (conditionIndex > -1) {
    normalizedConditions[conditionIndex] = condition;
    return normalizedConditions;
  }

  return [...normalizedConditions, condition];
}

export function removeChartCondition(conditions = [], conditionOrId = null) {
  const targetId = typeof conditionOrId === "object" ? conditionOrId?.id : conditionOrId;

  if (!targetId) {
    return Array.isArray(conditions) ? [...conditions] : [];
  }

  return (conditions || []).filter((condition) => condition?.id !== targetId);
}

export function mergeChartFilters(storedFilters = [], inlineFilters = []) {
  const normalizedStoredFilters = Array.isArray(storedFilters) ? storedFilters : [];
  const normalizedInlineFilters = Array.isArray(inlineFilters) ? inlineFilters : [];
  const inlineFilterIds = new Set(
    normalizedInlineFilters
      .filter((filter) => filter?.id)
      .map((filter) => filter.id)
  );

  return [
    ...normalizedStoredFilters.filter((filter) => !inlineFilterIds.has(filter?.id)),
    ...normalizedInlineFilters,
  ];
}

export function buildChartFilterRequest({
  storedFilters = [],
  inlineFilters = [],
  chartId = null,
  chart = null,
}) {
  const allFilters = mergeChartFilters(storedFilters, inlineFilters);
  const variables = {};

  allFilters
    .filter((filter) => filter?.type === "variable" && filter.variable && hasDefinedValue(filter.value))
    .forEach((filter) => {
      variables[filter.variable] = filter.value;
    });

  const applicableFilters = chart
    ? getApplicableDashboardFiltersForChart(allFilters, chart)
    : allFilters
      .filter((filter) => filter?.type !== "variable")
      .filter((filter) => {
        if (filter?.type === "date" && Array.isArray(filter.charts) && filter.charts.length > 0 && chartId !== null) {
          return filter.charts.includes(chartId);
        }

        return true;
      });

  return {
    allFilters,
    applicableFilters,
    variables,
  };
}

export function shouldRunFilterRequest({ filters = [], variables = {} } = {}) {
  return (filters || []).length > 0 || Object.keys(variables || {}).length > 0;
}
