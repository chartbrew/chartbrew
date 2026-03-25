import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  Autocomplete, Button, Chip, Separator, EmptyState, Input, Label, ListBox, SearchField, Select, Tooltip, useFilter,
} from "@heroui/react";
import { LuCheck, LuInfo, LuSettings } from "react-icons/lu";

import Row from "../../../components/Row";
import Text from "../../../components/Text";
import DatasetFilters from "../../../components/DatasetFilters";
import autoFieldSelector from "../../../modules/autoFieldSelector";
import { getDatasetFieldOptionsFromResponse, getDatasetFieldOptionsFromSchema } from "../../../modules/getDatasetFieldOptions";
import { operations } from "../../../modules/filterOperations";
import { runRequest as runDatasetRequest, updateDataset } from "../../../slices/dataset";
import getDatasetDisplayName from "../../../modules/getDatasetDisplayName";
import canAccess from "../../../config/canAccess";
import { selectUser } from "../../../slices/user";
import { selectTeam } from "../../../slices/team";

function ChartDatasetDataSetup({
  cdc,
  dataset,
  chart,
  teamId,
  legend,
  onSaveLegend,
  onUpdateCdc,
  onEditDataset,
}) {
  const { contains } = useFilter({ sensitivity: "base" });
  const dispatch = useDispatch();
  const datasetResponse = useSelector((state) => state.dataset.responses
    .find((response) => response.dataset_id === dataset?.id)?.data);

  const [fieldOptions, setFieldOptions] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const autoSuggestedRef = useRef({});

  const user = useSelector(selectUser);
  const team = useSelector(selectTeam);

  useEffect(() => {
    if (!dataset?.id || !teamId || datasetResponse || loadingFields) return;

    setLoadingFields(true);
    dispatch(runDatasetRequest({
      team_id: teamId,
      dataset_id: dataset.id,
      getCache: true,
    }))
      .unwrap()
      .catch(() => {
        toast.error("Could not load dataset fields. Please check your query.");
      })
      .finally(() => {
        setLoadingFields(false);
      });
  }, [dataset?.id, datasetResponse, teamId]);

  useEffect(() => {
    if (!dataset?.id) return;
    if (autoSuggestedRef.current[cdc?.id] && cdc?.id) return;

    let nextFieldOptions = [];
    let nextFieldsSchema = null;

    if (datasetResponse) {
      const { fieldOptions: responseFieldOptions, fieldsSchema } = getDatasetFieldOptionsFromResponse(datasetResponse);
      nextFieldOptions = responseFieldOptions;
      nextFieldsSchema = fieldsSchema;
    } else if (dataset?.fieldsSchema) {
      nextFieldOptions = getDatasetFieldOptionsFromSchema(dataset.fieldsSchema);
    }

    if (nextFieldOptions.length === 0) return;

    setFieldOptions(nextFieldOptions);

    if (nextFieldsSchema && JSON.stringify(dataset.fieldsSchema || {}) !== JSON.stringify(nextFieldsSchema)) {
      dispatch(updateDataset({
        team_id: teamId,
        dataset_id: dataset.id,
        data: { fieldsSchema: nextFieldsSchema },
      }));
    }

    if (!cdc?.id) return;

    const autoFields = autoFieldSelector(nextFieldOptions);
    const autoUpdates = {};

    if (!cdc.xAxis && autoFields.xAxis) autoUpdates.xAxis = autoFields.xAxis;
    if (!cdc.yAxis && autoFields.yAxis) autoUpdates.yAxis = autoFields.yAxis;
    if (!cdc.dateField && autoFields.dateField) autoUpdates.dateField = autoFields.dateField;
    if (!cdc.yAxisOperation && autoFields.yAxisOperation) autoUpdates.yAxisOperation = autoFields.yAxisOperation;

    if (Object.keys(autoUpdates).length > 0) {
      autoSuggestedRef.current[cdc.id] = true;
      onUpdateCdc(autoUpdates);
    } else {
      autoSuggestedRef.current[cdc.id] = true;
    }
  }, [cdc?.id, cdc?.xAxis, cdc?.yAxis, cdc?.dateField, cdc?.yAxisOperation, dataset?.id, dataset?.fieldsSchema, datasetResponse, teamId]);

  useEffect(() => {
    if (cdc?.id && autoSuggestedRef.current[cdc.id] === undefined) {
      autoSuggestedRef.current[cdc.id] = false;
    }
  }, [cdc?.id]);

  const filterDataset = useMemo(() => {
    return {
      ...dataset,
      ...cdc,
      id: dataset?.id,
      team_id: dataset?.team_id,
      VariableBindings: dataset?.VariableBindings || [],
      conditions: cdc?.conditions || [],
    };
  }, [cdc, dataset]);

  const filterOptions = (axis) => {
    let filteredOptions = fieldOptions;
    if (axis === "x" && chart?.type !== "table") {
      filteredOptions = filteredOptions.filter((field) => {
        if (field.type === "array" || (field.value && field.value.split("[]").length > 2)) {
          return false;
        }

        return true;
      });
    }

    if (chart?.type !== "table") return filteredOptions;

    filteredOptions = fieldOptions.filter((field) => field.type === "array");

    if (axis === "x") {
      filteredOptions = filteredOptions.filter((field) => {
        if (field.type === "array" || (field.value && field.value.split("[]").length > 2)) {
          return false;
        }

        return true;
      });
    }

    const rootObj = {
      key: "root[]",
      text: "Collection root",
      value: "root[]",
      type: "array",
      label: {
        style: { width: 55, textAlign: "center" },
        content: "root",
        size: "mini",
      },
    };

    const [rootField] = fieldOptions.filter((field) => field.value.indexOf([]) > -1);
    if (rootField) {
      rootObj.text = rootField.value.substring(0, rootField.value.lastIndexOf("."));
      rootObj.key = rootField.value.substring(0, rootField.value.lastIndexOf("."));
      rootObj.value = rootField.value.substring(0, rootField.value.lastIndexOf("."));
    }

    filteredOptions.unshift(rootObj);

    return filteredOptions;
  };

  const getDateFieldOptions = () => fieldOptions.filter((field) => field.type === "date");

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  return (
    <div>
      <Input
        placeholder="Enter a name for your series"
        label="Series name"
        value={legend}
        onChange={onSaveLegend.onChange}
        endContent={(
          <Row align="center" className="gap-2">
            {legend && legend !== cdc.legend && (
              <Tooltip>
                <Tooltip.Trigger>
                  <Button
                    isIconOnly
                    color="primary"
                    size="sm"
                    onPress={onSaveLegend.onSave}
                  >
                    <LuCheck />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content>Save series name</Tooltip.Content>
              </Tooltip>
            )}
            <Tooltip>
              <Tooltip.Trigger>
                <div><LuInfo size={18} className="text-default-400" /></div>
              </Tooltip.Trigger>
              <Tooltip.Content>{`Dataset: ${getDatasetDisplayName(dataset)}`}</Tooltip.Content>
            </Tooltip>
          </Row>
        )}
      />
      <div className="h-4" />

      {_canAccess("projectAdmin") && (
        <Button
          variant="ghost"
          fullWidth
          endContent={<LuSettings size={18} />}
          onPress={onEditDataset}
        >
          Edit dataset
        </Button>
      )}

      <div className="h-8" />
      <Separator />
      <div className="h-8" />

      <Text b>Data setup</Text>
      <div className="h-4" />

      <Autocomplete
        placeholder="Select dimension"
        value={cdc.xAxis || null}
        onChange={(value) => onUpdateCdc({ xAxis: value })}
        isPending={loadingFields}
        selectionMode="single"
        variant="secondary"
        aria-label="Select a dimension"
        description="The field to group data by (typically time)"
      >
        <Label>Dimension (X-axis)</Label>
        <Autocomplete.Trigger>
          <Autocomplete.Value />
          <Autocomplete.Indicator />
        </Autocomplete.Trigger>
        <Autocomplete.Popover>
          <Autocomplete.Filter filter={contains}>
            <SearchField autoFocus name="cdc-dimension-search" variant="secondary">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search dimensions..." />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
              {filterOptions("x").map((option) => (
                <ListBox.Item key={option.value} id={option.value} textValue={option.text}>
                  <Chip size="sm" variant="flat" className={"min-w-[70px] text-center"} color={option.label.color}>{option.label.content}</Chip>
                  {option.text}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Autocomplete.Filter>
        </Autocomplete.Popover>
      </Autocomplete>

      <div className="h-8" />

      <Autocomplete
        placeholder="Select metric"
        value={cdc.yAxis || null}
        onChange={(value) => onUpdateCdc({ yAxis: value })}
        isPending={loadingFields}
        selectionMode="single"
        variant="secondary"
        aria-label="Select a metric"
        description="The field to measure or count"
      >
        <Label>Metric (Y-axis)</Label>
        <Autocomplete.Trigger>
          <Autocomplete.Value />
          <Autocomplete.Indicator />
        </Autocomplete.Trigger>
        <Autocomplete.Popover>
          <Autocomplete.Filter filter={contains}>
            <SearchField autoFocus name="cdc-metric-search" variant="secondary">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search metrics..." />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
              {fieldOptions.map((option) => (
                <ListBox.Item key={option.value} id={option.value} textValue={option.text}>
                  <Chip size="sm" variant="flat" className={"min-w-[70px] text-center"} color={option.label.color}>{option.label.content}</Chip>
                  {option.text}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Autocomplete.Filter>
        </Autocomplete.Popover>
      </Autocomplete>

      <div className="h-4" />

      <Select
        placeholder="Select operation"
        onChange={(value) => onUpdateCdc({ yAxisOperation: value })}
        value={cdc.yAxisOperation || null}
        selectionMode="single"
        variant="secondary"
        aria-label="Select an operation"
      >
        <Label>Operation</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {operations.map((option) => (
              <ListBox.Item key={option.value} id={option.value} textValue={option.text}>
                {option.text}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <div className="h-8" />

      <Autocomplete
        placeholder="Select a field"
        value={cdc.dateField || null}
        onChange={(value) => onUpdateCdc({ dateField: value })}
        isPending={loadingFields}
        selectionMode="single"
        variant="secondary"
        aria-label="Select a date field used for filtering"
        description="Used for time-based filtering"
      >
        <Label>Date field</Label>
        <Autocomplete.Trigger>
          <Autocomplete.Value />
          <Autocomplete.Indicator />
        </Autocomplete.Trigger>
        <Autocomplete.Popover>
          <Autocomplete.Filter filter={contains}>
            <SearchField autoFocus name="cdc-date-field-search" variant="secondary">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search fields..." />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
              {getDateFieldOptions().map((option) => (
                <ListBox.Item key={option.value} id={option.value} textValue={option.text}>
                  <Chip size="sm" variant="flat" className={"min-w-[70px] text-center"} color={option.label.color}>{option.label.content}</Chip>
                  {option.text}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Autocomplete.Filter>
        </Autocomplete.Popover>
      </Autocomplete>

      <div className="h-8" />
      <Separator />
      <div className="h-8" />

      <div className="font-bold">Filters</div>
      <div className="h-4" />

      <DatasetFilters
        onUpdate={onUpdateCdc}
        fieldOptions={fieldOptions}
        dataset={filterDataset}
      />
    </div>
  );
}

ChartDatasetDataSetup.propTypes = {
  cdc: PropTypes.object.isRequired,
  dataset: PropTypes.object.isRequired,
  chart: PropTypes.object.isRequired,
  teamId: PropTypes.number,
  legend: PropTypes.string.isRequired,
  onSaveLegend: PropTypes.shape({
    onChange: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
  }).isRequired,
  onUpdateCdc: PropTypes.func.isRequired,
  onEditDataset: PropTypes.func.isRequired,
};

ChartDatasetDataSetup.defaultProps = {
  teamId: null,
};

export default ChartDatasetDataSetup;
