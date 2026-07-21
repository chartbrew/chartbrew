import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  Description,
  EmptyState,
  Label,
  ListBox,
  NumberField,
  SearchField,
  Select,
  Separator,
  Switch,
  Tooltip,
  useFilter,
} from "@heroui/react";
import {
  LuPlus,
  LuSettings,
  LuTrash2,
} from "react-icons/lu";

import DatasetFilters from "../../../components/DatasetFilters";
import {
  getDatasetFieldOptionsFromResponse,
  getDatasetFieldOptionsFromSchema,
} from "../../../modules/getDatasetFieldOptions";
import {
  AGGREGATIONS,
  addVisualizationLayer,
  getDimensionRole,
  getLayerFieldRequirements,
  getPreferredDateField,
  getVisualizationTimeField,
  isVisualizationReady,
  removeVisualizationLayer,
  updateLayerAggregation,
  updateLayerField,
  updateLayerGoal,
  updateLayerRowPath,
  updateLayerSeriesOptions,
} from "../../../modules/visualization";
import { runRequest as runDatasetRequest, updateDataset } from "../../../slices/dataset";
import canAccess from "../../../config/canAccess";
import { selectUser } from "../../../slices/user";
import { selectTeam } from "../../../slices/team";

const MULTI_VALUE_MARKS = new Set(["bar", "line", "radar"]);

function LayerGoalField({ initialValue, onSave }) {
  const [value, setValue] = useState(initialValue ?? undefined);
  const hasGoal = Number.isFinite(value);
  const hasChanges = value !== initialValue;

  return (
    <div className="rounded-xl border border-divider bg-content2/30 p-3">
      <NumberField
        name="value-goal"
        value={value}
        variant="secondary"
        onChange={setValue}
      >
        <Label>Goal</Label>
        <NumberField.Group>
          <NumberField.Input placeholder="Enter a target value" />
        </NumberField.Group>
        <Description>Used by this value’s KPI progress indicator.</Description>
      </NumberField>
      <div className="mt-3 flex gap-2">
        <Button
          isDisabled={!hasGoal || !hasChanges}
          size="sm"
          variant="secondary"
          onPress={() => onSave(value)}
        >
          Save goal
        </Button>
        {initialValue !== null && initialValue !== undefined && (
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => {
              setValue(undefined);
              onSave(null);
            }}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

LayerGoalField.propTypes = {
  initialValue: PropTypes.number,
  onSave: PropTypes.func.isRequired,
};

function SeriesLimitControl({ initialIncludeOther, initialLimit, onSave }) {
  const [limit, setLimit] = useState(initialLimit ?? undefined);
  const [includeOther, setIncludeOther] = useState(initialIncludeOther);
  const hasLimit = Number.isInteger(limit) && limit > 0;
  const hasChanges = limit !== initialLimit || includeOther !== initialIncludeOther;

  return (
    <div className="rounded-xl border border-divider bg-content2/30 p-3">
      <NumberField
        minValue={1}
        name="generated-series-limit"
        value={limit}
        variant="secondary"
        onChange={setLimit}
      >
        <Label>Show top series</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input size="" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Limit the number of series to show.</Description>
      </NumberField>
      <Switch
        className="mt-3"
        isDisabled={!hasLimit}
        isSelected={includeOther}
        onChange={setIncludeOther}
      >
        <Switch.Control><Switch.Thumb /></Switch.Control>
        <Switch.Content><Label>Combine the remainder as Other</Label></Switch.Content>
      </Switch>
      <div className="mt-3 flex gap-2">
        <Button
          isDisabled={!hasChanges || !hasLimit}
          size="sm"
          variant="secondary"
          onPress={() => onSave({ includeOther, limit })}
        >
          Apply
        </Button>
        {initialLimit && (
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => onSave({ includeOther: false, limit: null })}
          >
            Show all
          </Button>
        )}
      </div>
    </div>
  );
}

SeriesLimitControl.propTypes = {
  initialIncludeOther: PropTypes.bool,
  initialLimit: PropTypes.number,
  onSave: PropTypes.func.isRequired,
};

function getValueLabel(layer, index) {
  const configuredLabel = layer.encoding?.value?.title || layer.name;
  if (configuredLabel && !/^(Layer|Metric|Value) \d+$/.test(configuredLabel)) {
    return configuredLabel;
  }

  const field = layer.encoding?.value?.field;
  if (field) return field.replace(/^root\[\]\./, "").replace(/^root\./, "");
  return `Value ${index + 1}`;
}

function FieldPicker({
  isClearable,
  description,
  fieldOptions,
  isPending,
  label,
  onChange,
  placeholder,
  value,
}) {
  const { contains } = useFilter({ sensitivity: "base" });

  return (
    <Autocomplete
      placeholder={placeholder}
      value={value || null}
      onChange={onChange}
      isPending={isPending}
      selectionMode="single"
      variant="secondary"
      aria-label={label}
      description={description}
    >
      <Label>{label}</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value />
        {isClearable && <Autocomplete.ClearButton />}
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={contains}>
          <SearchField autoFocus name={`${label.toLowerCase().replaceAll(" ", "-")}-search`} variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={`Search ${label.toLowerCase()}...`} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => <EmptyState>No matching fields</EmptyState>}>
            {fieldOptions.map((option) => (
              <ListBox.Item key={option.value} id={option.value} textValue={option.text}>
                <Chip
                  size="sm"
                  className="mr-2 min-w-[70px] justify-center"
                  variant="soft"
                  color={option.label.color}
                >
                  {option.label.content}
                </Chip>
                {option.text}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}

FieldPicker.propTypes = {
  description: PropTypes.string.isRequired,
  fieldOptions: PropTypes.array.isRequired,
  isClearable: PropTypes.bool,
  isPending: PropTypes.bool.isRequired,
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string.isRequired,
  value: PropTypes.string,
};

FieldPicker.defaultProps = {
  isClearable: false,
  value: null,
};

function ChartDatasetDataSetup({
  cdc,
  dataset,
  chart,
  teamId,
  onUpdateCdc,
  onUpdateVisualization,
  onEditDataset,
}) {
  const dispatch = useDispatch();
  const datasetResponse = useSelector((state) => state.dataset.responses
    .find((response) => response.dataset_id === dataset?.id)?.data);
  const [loadingFields, setLoadingFields] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const user = useSelector(selectUser);
  const team = useSelector(selectTeam);

  const fieldData = useMemo(() => {
    if (datasetResponse) return getDatasetFieldOptionsFromResponse(datasetResponse);
    return {
      fieldOptions: getDatasetFieldOptionsFromSchema(dataset?.fieldsSchema || {}),
      fieldsSchema: dataset?.fieldsSchema || {},
    };
  }, [dataset?.fieldsSchema, datasetResponse]);
  const fieldOptions = fieldData.fieldOptions;
  const dateFieldOptions = fieldOptions.filter((field) => field.type === "date");
  const bindingLayers = (chart.visualization?.layers || []).filter((layer) => {
    return `${layer.bindingId}` === `${cdc.id}`;
  });
  const selectedLayer = bindingLayers.find((layer) => layer.id === selectedLayerId)
    || bindingLayers[0];
  const requirements = getLayerFieldRequirements(selectedLayer?.mark || chart.type);
  const dimensionRole = getDimensionRole(selectedLayer);
  const dimensionField = selectedLayer?.encoding?.[dimensionRole]?.field || null;
  const valueField = selectedLayer?.encoding?.value?.field || null;
  const breakdownField = selectedLayer?.encoding?.breakdown?.field || null;
  const timeField = getVisualizationTimeField(chart.visualization, cdc.id);
  const dateField = cdc.dateField || timeField || getPreferredDateField(dateFieldOptions);
  const canAddValue = MULTI_VALUE_MARKS.has(selectedLayer?.mark || chart.type);
  const generatedSeries = (chart.chartData?.meta?.series || []).filter((series) => {
    return series.layerId === selectedLayer?.id;
  });
  const layerWarnings = (chart.chartData?.meta?.warnings || []).filter((warning) => {
    return warning.layerId === selectedLayer?.id;
  });
  const filterDataset = useMemo(() => ({
    ...dataset,
    ...cdc,
    id: dataset?.id,
    team_id: dataset?.team_id,
    VariableBindings: dataset?.VariableBindings || [],
    conditions: cdc?.conditions || [],
  }), [cdc, dataset]);
  const collectionOptions = [{
    key: "root[]",
    text: "Collection root",
    value: "root[]",
    type: "array",
    label: { color: "default", content: "root" },
  }, ...fieldOptions.filter((field) => field.type === "array")];

  const _loadFields = async () => {
    if (!dataset?.id || !teamId || loadingFields) return;
    setLoadingFields(true);
    try {
      const response = await dispatch(runDatasetRequest({
        team_id: teamId,
        dataset_id: dataset.id,
        getCache: true,
      })).unwrap();
      const nextFieldData = getDatasetFieldOptionsFromResponse(response?.data || response);
      if (Object.keys(nextFieldData.fieldsSchema).length > 0) {
        dispatch(updateDataset({
          team_id: teamId,
          dataset_id: dataset.id,
          data: { fieldsSchema: nextFieldData.fieldsSchema },
        }));
      }
      if (!cdc.dateField) {
        const suggestedDateField = getPreferredDateField(nextFieldData.fieldOptions);
        if (suggestedDateField) onUpdateCdc({ dateField: suggestedDateField });
      }
    } catch (error) {
      toast.error("Could not load dataset fields. Please check the dataset query.");
    } finally {
      setLoadingFields(false);
    }
  };

  const _fieldOption = (value) => fieldOptions.find((field) => field.value === value) || null;
  const _commitVisualization = (nextVisualization, chartChanges = {}, cdcChanges = null) => {
    onUpdateVisualization({
      cdcChanges,
      chartChanges,
      refresh: isVisualizationReady(nextVisualization),
      visualization: nextVisualization,
    });
  };
  const _updateField = (role, value) => {
    if (!selectedLayer) return;
    const fieldOption = _fieldOption(value);
    const nextVisualization = updateLayerField(
      chart.visualization,
      selectedLayer.id,
      role,
      fieldOption
    );
    let cdcChanges = null;
    if (role === "dimension" && fieldOption?.type === "date") {
      cdcChanges = { dateField: fieldOption.value };
    } else if (!cdc.dateField) {
      const suggestedDateField = getPreferredDateField(dateFieldOptions);
      if (suggestedDateField) cdcChanges = { dateField: suggestedDateField };
    }
    _commitVisualization(nextVisualization, {}, cdcChanges);
  };
  const _addValue = () => {
    const nextVisualization = addVisualizationLayer(chart.visualization, cdc.id, {
      metric: true,
      sourceLayer: selectedLayer,
    });
    const newLayer = nextVisualization.layers[nextVisualization.layers.length - 1];
    setSelectedLayerId(newLayer.id);
    _commitVisualization(nextVisualization);
  };

  return (
    <div className="flex flex-col gap-4">
      {selectedLayer && (
        <>
          <div>
            <div className="mb-4 flex items-start">
              {canAccess("projectAdmin", user.id, team?.TeamRoles) && (
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      aria-label="Edit dataset"
                      variant="tertiary"
                      size="sm"
                      onPress={onEditDataset}
                    >
                      <LuSettings size={16} /> Edit dataset
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Edit dataset</Tooltip.Content>
                </Tooltip>
              )}
            </div>

            {bindingLayers.length > 1 && (
              <div className="mb-4 rounded-xl bg-content2/40 p-2">
                <div className="mb-2 px-1 text-xs font-medium text-foreground-500">
                  Choose a value to edit
                </div>
                <div className="flex flex-wrap gap-1">
                  {bindingLayers.map((layer, index) => (
                    <Button
                      key={layer.id}
                      size="sm"
                      variant={selectedLayer.id === layer.id ? "secondary" : "tertiary"}
                      onPress={() => setSelectedLayerId(layer.id)}
                    >
                      {getValueLabel(layer, index)}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {fieldOptions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-divider p-4 text-center">
                <div className="text-sm font-medium">Load a data sample to choose fields</div>
                <div className="mt-1 text-xs text-foreground-500">
                  Chartbrew will use cached data when it is available.
                </div>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="secondary"
                  isPending={loadingFields}
                  onPress={_loadFields}
                >
                  Load fields
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {requirements.collection && (
                  <FieldPicker
                    label="Rows"
                    placeholder="Select a row collection"
                    description="The array that contains the table rows."
                    fieldOptions={collectionOptions}
                    isPending={loadingFields}
                    value={selectedLayer.rowPath}
                    onChange={(value) => {
                      const nextVisualization = updateLayerRowPath(
                        chart.visualization,
                        selectedLayer.id,
                        value
                      );
                      _commitVisualization(nextVisualization);
                    }}
                  />
                )}

                {requirements.dimension && (
                  <FieldPicker
                    label={selectedLayer.mark === "matrix" ? "Date" : "Category or time"}
                    placeholder="Select a grouping field"
                    description="Values are grouped into one point or bar per category."
                    fieldOptions={fieldOptions.filter((field) => field.type !== "array")}
                    isPending={loadingFields}
                    value={dimensionField}
                    onChange={(value) => _updateField("dimension", value)}
                  />
                )}

                {requirements.value && (
                  <>
                    <FieldPicker
                      label="Value"
                      placeholder="Select a value field"
                      description="The value to measure, count, or aggregate."
                      fieldOptions={fieldOptions.filter((field) => field.type !== "array")}
                      isPending={loadingFields}
                      value={valueField}
                      onChange={(value) => _updateField("value", value)}
                    />
                    <Select
                      placeholder="Choose an aggregation"
                      onChange={(aggregate) => {
                        const nextVisualization = updateLayerAggregation(
                          chart.visualization,
                          selectedLayer.id,
                          aggregate
                        );
                        _commitVisualization(nextVisualization);
                      }}
                      value={selectedLayer.encoding?.value?.aggregate || "none"}
                      selectionMode="single"
                      variant="secondary"
                      aria-label="Value aggregation"
                    >
                      <Label>Summarize by</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {AGGREGATIONS.map((aggregate) => (
                            <ListBox.Item
                              key={aggregate.id}
                              id={aggregate.id}
                              textValue={aggregate.label}
                            >
                              {aggregate.label}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>

                    {["kpi", "avg", "gauge"].includes(selectedLayer.mark) && (
                      <LayerGoalField
                        key={`${selectedLayer.id}-${selectedLayer.goal ?? "none"}`}
                        initialValue={selectedLayer.goal}
                        onSave={(goal) => {
                          const nextVisualization = updateLayerGoal(
                            chart.visualization,
                            selectedLayer.id,
                            goal
                          );
                          _commitVisualization(nextVisualization);
                        }}
                      />
                    )}

                    {canAddValue && (
                      <Button
                        className="self-start"
                        size="sm"
                        variant="tertiary"
                        onPress={_addValue}
                      >
                        <LuPlus size={14} />
                        Add another value
                      </Button>
                    )}
                  </>
                )}

                {requirements.breakdown && (
                  <FieldPicker
                    label="Break down by"
                    placeholder="Select a series field"
                    description="Creates one series for every unique value without another dataset."
                    fieldOptions={fieldOptions.filter((field) => field.type !== "array")}
                    isClearable
                    isPending={loadingFields}
                    value={breakdownField}
                    onChange={(value) => _updateField("breakdown", value)}
                  />
                )}
              </div>
            )}
          </div>

          {breakdownField && generatedSeries.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="text-xs font-medium text-foreground-500">
                  Generated series
                </div>
                <Chip size="sm" variant="soft" color="accent">
                  {generatedSeries.length}
                </Chip>
              </div>
              <div className="flex flex-wrap gap-1">
                {generatedSeries.slice(0, 6).map((series) => (
                  <Chip key={series.id} size="sm" variant="secondary">
                    {series.label}
                  </Chip>
                ))}
                {generatedSeries.length > 6 && (
                  <Chip size="sm" variant="secondary">{`+${generatedSeries.length - 6}`}</Chip>
                )}
              </div>
            </div>
          )}

          {breakdownField && (
            <SeriesLimitControl
              key={`${selectedLayer.id}-${selectedLayer.options?.series?.limit || "all"}-${selectedLayer.options?.series?.includeOther || false}`}
              initialIncludeOther={Boolean(selectedLayer.options?.series?.includeOther)}
              initialLimit={selectedLayer.options?.series?.limit}
              onSave={(changes) => {
                const nextVisualization = updateLayerSeriesOptions(
                  chart.visualization,
                  selectedLayer.id,
                  changes
                );
                _commitVisualization(nextVisualization);
              }}
            />
          )}

          {layerWarnings.map((warning) => (
            <Alert status="warning" key={`${warning.code}-${warning.layerId}`}>
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Large number of generated series</Alert.Title>
                <Alert.Description>{warning.message}</Alert.Description>
              </Alert.Content>
            </Alert>
          ))}

          {bindingLayers.length > 1 && (
            <Button
              className="self-start"
              size="sm"
              variant="danger-soft"
              onPress={() => {
                const nextVisualization = removeVisualizationLayer(
                  chart.visualization,
                  selectedLayer.id
                );
                setSelectedLayerId(null);
                _commitVisualization(nextVisualization);
              }}
            >
              <LuTrash2 size={15} />
              Remove value
            </Button>
          )}
        </>
      )}

      <Separator />

      <div>
        <div className="font-semibold text-foreground">Filters</div>
        <div className="mb-3 text-sm text-foreground-500">
          Filter rows before chart values are calculated.
        </div>
        {dateFieldOptions.length > 0 && (
          <div className="mb-4">
            <FieldPicker
              label="Date field"
              placeholder="Select a date field"
              description="Used by Chart Settings and dashboard date filters."
              fieldOptions={dateFieldOptions}
              isPending={loadingFields}
              value={dateField}
              onChange={(value) => onUpdateCdc({ dateField: value })}
            />
          </div>
        )}
        <DatasetFilters
          onUpdate={onUpdateCdc}
          fieldOptions={fieldOptions}
          dataset={filterDataset}
        />
      </div>
    </div>
  );
}

ChartDatasetDataSetup.propTypes = {
  cdc: PropTypes.object.isRequired,
  dataset: PropTypes.object.isRequired,
  chart: PropTypes.object.isRequired,
  teamId: PropTypes.number,
  onUpdateCdc: PropTypes.func.isRequired,
  onUpdateVisualization: PropTypes.func.isRequired,
  onEditDataset: PropTypes.func.isRequired,
};

ChartDatasetDataSetup.defaultProps = {
  teamId: null,
};

export default ChartDatasetDataSetup;
