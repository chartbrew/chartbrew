import {
  CHARTABLE_SCALAR_FIELD_TYPES,
  createFieldLabel,
  formatFieldPath,
  getFieldTypeColor,
  normalizeEditableFieldsMetadata,
} from "./datasetFieldMetadata";

function normalizeLegacyFieldId(fieldPath = "") {
  const formattedPath = formatFieldPath(fieldPath);
  return formattedPath || String(fieldPath || "");
}

function getDatasetFieldEntries(chart = {}, cdc = {}) {
  const dataset = cdc?.Dataset || {};

  if (Array.isArray(dataset?.fieldsMetadata) && dataset.fieldsMetadata.length > 0) {
    return normalizeEditableFieldsMetadata(dataset.fieldsMetadata)
      .filter((field) => (
        field?.id
        && CHARTABLE_SCALAR_FIELD_TYPES.includes(field?.type)
        && field.enabled !== false
        && field.excludeFromCharts !== true
        && field.missing !== true
      ))
      .map((field) => ({
        chartId: chart.id,
        chartName: chart.name,
        cdcId: cdc.id,
        datasetId: dataset.id || cdc.dataset_id || null,
        fieldId: field.id,
        legacyPath: field.legacyPath || field.id,
        label: field.label || createFieldLabel(field.id),
        type: field.type,
      }));
  }

  if (dataset?.fieldsSchema && typeof dataset.fieldsSchema === "object") {
    return Object.keys(dataset.fieldsSchema)
      .filter((fieldPath) => CHARTABLE_SCALAR_FIELD_TYPES.includes(dataset.fieldsSchema[fieldPath]))
      .map((fieldPath) => ({
        chartId: chart.id,
        chartName: chart.name,
        cdcId: cdc.id,
        datasetId: dataset.id || cdc.dataset_id || null,
        fieldId: normalizeLegacyFieldId(fieldPath),
        legacyPath: fieldPath,
        label: createFieldLabel(fieldPath),
        type: dataset.fieldsSchema[fieldPath],
      }));
  }

  return [];
}

function getDatasetVariableEntries(chart = {}, cdc = {}) {
  const dataset = cdc?.Dataset || {};
  const entries = [];

  (dataset?.VariableBindings || []).forEach((binding) => {
    if (!binding?.name) {
      return;
    }

    entries.push({
      chartId: chart.id,
      chartName: chart.name,
      cdcId: cdc.id,
      datasetId: dataset.id || cdc.dataset_id || null,
      variableName: binding.name,
      type: binding.type || "string",
      source: "dataset",
    });
  });

  (dataset?.DataRequests || []).forEach((request) => {
    (request?.VariableBindings || []).forEach((binding) => {
      if (!binding?.name) {
        return;
      }

      entries.push({
        chartId: chart.id,
        chartName: chart.name,
        cdcId: cdc.id,
        datasetId: dataset.id || cdc.dataset_id || null,
        variableName: binding.name,
        type: binding.type || "string",
        source: "request",
      });
    });
  });

  return entries;
}

function getQuestionFilterEntries(chart = {}, cdc = {}) {
  const dataset = cdc?.Dataset || {};
  const fields = getDatasetFieldEntries(chart, cdc);
  const fieldLookup = new Map();

  fields.forEach((field) => {
    [field.fieldId, field.legacyPath]
      .filter(Boolean)
      .forEach((key) => {
        if (!fieldLookup.has(key)) {
          fieldLookup.set(key, field);
        }
      });
  });

  return (Array.isArray(cdc?.vizConfig?.filters) ? cdc.vizConfig.filters : [])
    .filter((filter) => filter?.exposed === true && filter?.fieldId)
    .map((filter) => {
      const fieldEntry = fieldLookup.get(filter.fieldId) || null;
      const fieldLabel = fieldEntry?.label || createFieldLabel(filter.fieldId);

      return {
        chartId: chart.id,
        chartName: chart.name,
        cdcId: cdc.id,
        datasetId: dataset.id || cdc.dataset_id || null,
        fieldId: fieldEntry?.fieldId || normalizeLegacyFieldId(filter.fieldId),
        legacyPath: fieldEntry?.legacyPath || filter.fieldId,
        label: filter.label || `${fieldLabel} filter`,
        type: filter.type || fieldEntry?.type || null,
        filterId: filter.id || null,
        bindingId: filter.bindingId || filter.id || null,
        operator: filter.operator || "is",
        targetType: "questionFilter",
      };
    })
    .filter((entry) => Boolean(entry.filterId || entry.bindingId));
}

function buildBindingOption(entry) {
  return {
    chartId: entry.chartId,
    cdcId: entry.cdcId,
    datasetId: entry.datasetId,
    targetType: "field",
    fieldId: entry.fieldId,
    legacyPath: entry.legacyPath,
  };
}

function buildQuestionFilterBindingOption(entry) {
  return {
    chartId: entry.chartId,
    cdcId: entry.cdcId,
    datasetId: entry.datasetId,
    targetType: "questionFilter",
    fieldId: entry.fieldId,
    legacyPath: entry.legacyPath,
    bindingId: entry.bindingId,
    filterId: entry.filterId,
    operator: entry.operator,
  };
}

function buildVariableBindingOption(entry) {
  return {
    chartId: entry.chartId,
    cdcId: entry.cdcId,
    datasetId: entry.datasetId,
    targetType: "variable",
    variableName: entry.variableName,
    type: entry.type,
    source: entry.source,
  };
}

function matchesBindingScope(entry = {}, scopeBinding = {}) {
  return (
    `${entry.chartId}` === `${scopeBinding.chartId}`
    && `${entry.cdcId}` === `${scopeBinding.cdcId}`
    && `${entry.datasetId}` === `${scopeBinding.datasetId}`
  );
}

export function getDashboardFieldOptions(charts = [], options = {}) {
  const includeTypes = Array.isArray(options.includeTypes) && options.includeTypes.length > 0
    ? new Set(options.includeTypes)
    : null;
  const excludeTypes = Array.isArray(options.excludeTypes) && options.excludeTypes.length > 0
    ? new Set(options.excludeTypes)
    : null;
  const groupedOptions = new Map();

  (charts || []).forEach((chart) => {
    if (chart?.type === "markdown") {
      return;
    }

    (chart?.ChartDatasetConfigs || []).forEach((cdc) => {
      [...getDatasetFieldEntries(chart, cdc), ...getQuestionFilterEntries(chart, cdc)].forEach((entry) => {
        if (includeTypes && !includeTypes.has(entry.type)) {
          return;
        }

        if (excludeTypes && excludeTypes.has(entry.type)) {
          return;
        }

        const optionKey = entry.targetType === "questionFilter"
          ? `questionFilter::${entry.bindingId || entry.filterId}::${entry.type}`
          : `${entry.fieldId}::${entry.type}`;
        if (!groupedOptions.has(optionKey)) {
          groupedOptions.set(optionKey, {
            key: optionKey,
            text: entry.label,
            fieldId: entry.fieldId,
            field: entry.legacyPath,
            type: entry.type,
            targetType: entry.targetType || "field",
            bindingId: entry.bindingId || null,
            filterId: entry.filterId || null,
            operator: entry.operator || null,
            bindings: [],
            chartIds: new Set(),
            chartNames: new Set(),
            legacyPaths: new Set(),
          });
        }

        const option = groupedOptions.get(optionKey);
        option.bindings.push(
          entry.targetType === "questionFilter"
            ? buildQuestionFilterBindingOption(entry)
            : buildBindingOption(entry)
        );
        option.chartIds.add(entry.chartId);
        option.chartNames.add(entry.chartName);
        option.legacyPaths.add(entry.legacyPath);
      });
    });
  });

  return Array.from(groupedOptions.values())
    .map((option) => ({
      key: option.key,
      text: option.text,
      fieldId: option.fieldId,
      field: option.field,
      type: option.type,
      targetType: option.targetType,
      bindingId: option.bindingId,
      filterId: option.filterId,
      operator: option.operator,
      bindings: option.bindings,
      chartIds: Array.from(option.chartIds),
      chartNames: Array.from(option.chartNames),
      legacyPaths: Array.from(option.legacyPaths),
      label: {
        content: option.type || "unknown",
        color: getFieldTypeColor(option.type),
      },
    }))
    .sort((left, right) => left.text.localeCompare(right.text));
}

export function getDashboardDateFieldOptions(charts = []) {
  return getDashboardFieldOptions(charts, {
    includeTypes: ["date"],
  });
}

export function getDashboardVariableOptions(charts = [], scopeBindings = [], options = {}) {
  const includeTypes = Array.isArray(options.includeTypes) && options.includeTypes.length > 0
    ? new Set(options.includeTypes)
    : null;
  const scopedBindings = Array.isArray(scopeBindings) ? scopeBindings : [];
  const restrictScope = scopedBindings.length > 0;
  const groupedOptions = new Map();

  (charts || []).forEach((chart) => {
    if (chart?.type === "markdown") {
      return;
    }

    (chart?.ChartDatasetConfigs || []).forEach((cdc) => {
      getDatasetVariableEntries(chart, cdc).forEach((entry) => {
        if (includeTypes && !includeTypes.has(entry.type)) {
          return;
        }

        if (restrictScope && !scopedBindings.some((binding) => matchesBindingScope(entry, binding))) {
          return;
        }

        const optionKey = `${entry.variableName}::${entry.type}`;
        if (!groupedOptions.has(optionKey)) {
          groupedOptions.set(optionKey, {
            key: optionKey,
            text: entry.variableName,
            variableName: entry.variableName,
            type: entry.type,
            bindings: [],
            chartIds: new Set(),
            chartNames: new Set(),
            sources: new Set(),
          });
        }

        const option = groupedOptions.get(optionKey);
        option.bindings.push(buildVariableBindingOption(entry));
        option.chartIds.add(entry.chartId);
        option.chartNames.add(entry.chartName);
        option.sources.add(entry.source);
      });
    });
  });

  return Array.from(groupedOptions.values())
    .map((option) => ({
      key: option.key,
      text: option.text,
      variableName: option.variableName,
      type: option.type,
      bindings: option.bindings,
      chartIds: Array.from(option.chartIds),
      chartNames: Array.from(option.chartNames),
      sources: Array.from(option.sources),
      label: {
        content: option.type || "unknown",
        color: getFieldTypeColor(option.type),
      },
    }))
    .sort((left, right) => left.text.localeCompare(right.text));
}

export function applyDashboardFieldOption(filter = {}, option = null) {
  if (!option) {
    return {
      ...filter,
      selectedFieldKey: "",
      fieldId: "",
      field: "",
      fieldLabel: "",
      dataType: "",
      targetType: "field",
      bindingId: "",
      filterId: "",
      bindings: [],
      charts: [],
    };
  }

  return {
    ...filter,
    selectedFieldKey: option.key,
    fieldId: option.fieldId,
    field: option.field,
    fieldLabel: option.text,
    dataType: option.type,
    targetType: option.targetType || "field",
    bindingId: option.bindingId || "",
    filterId: option.filterId || "",
    operator: option.operator || filter.operator,
    bindings: option.bindings,
    charts: option.chartIds,
  };
}

export function findDashboardFieldOption(options = [], filter = {}) {
  const selectedFieldKey = filter?.selectedFieldKey || null;
  const selectedFieldId = filter?.fieldId || null;
  const selectedField = filter?.field || null;
  const selectedBindingId = filter?.bindingId || null;
  const selectedFilterId = filter?.filterId || null;

  return (options || []).find((option) => (
    (selectedFieldKey && option.key === selectedFieldKey)
    || (selectedBindingId && option.bindingId === selectedBindingId)
    || (selectedFilterId && option.filterId === selectedFilterId)
    || (selectedFieldId && option.fieldId === selectedFieldId && option.type === filter?.dataType)
    || (selectedFieldId && option.fieldId === selectedFieldId)
    || (selectedField && option.legacyPaths.includes(selectedField))
  )) || null;
}

export function findDashboardVariableOption(options = [], value = null) {
  if (!value) {
    return null;
  }

  return (options || []).find((option) => (
    option.key === value
    || option.variableName === value
  )) || null;
}
