import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  Autocomplete, AutocompleteItem, Button, Chip, Divider, Input, Select, SelectItem, Spacer, Tooltip,
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
              <Tooltip content="Save series name">
                <Button
                  isIconOnly
                  color="primary"
                  size="sm"
                  onPress={onSaveLegend.onSave}
                >
                  <LuCheck />
                </Button>
              </Tooltip>
            )}
            <Tooltip content={`Dataset: ${getDatasetDisplayName(dataset)}`}>
              <div><LuInfo size={18} className="text-default-400" /></div>
            </Tooltip>
          </Row>
        )}
      />

      <Spacer y={2} />

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

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <Text b>Data setup</Text>
      <Spacer y={2} />

      <Autocomplete
        label="Dimension (X-axis)"
        labelPlacement="outside"
        placeholder="Select dimension"
        selectedKey={cdc.xAxis || ""}
        onSelectionChange={(key) => onUpdateCdc({ xAxis: key })}
        isLoading={loadingFields}
        aria-label="Select a dimension"
        description="The field to group data by (typically time)"
      >
        {filterOptions("x").map((option) => (
          <AutocompleteItem
            key={option.value}
            startContent={(
              <Chip size="sm" variant="flat" className={"min-w-[70px] text-center"} color={option.label.color}>{option.label.content}</Chip>
            )}
            description={option.isObject ? "Key-Value visualization" : null}
            textValue={option.text}
          >
            {option.text}
          </AutocompleteItem>
        ))}
      </Autocomplete>

      <Spacer y={4} />

      <Autocomplete
        label="Metric (Y-axis)"
        labelPlacement="outside"
        placeholder="Select metric"
        selectedKey={cdc.yAxis || ""}
        onSelectionChange={(key) => onUpdateCdc({ yAxis: key })}
        isLoading={loadingFields}
        aria-label="Select a metric"
        description="The field to measure or count"
      >
        {fieldOptions.map((option) => (
          <AutocompleteItem
            key={option.value}
            startContent={(
              <Chip size="sm" variant="flat" className={"min-w-[70px] text-center"} color={option.label.color}>{option.label.content}</Chip>
            )}
            description={option.isObject ? "Key-Value visualization" : null}
            textValue={option.text}
          >
            {option.text}
          </AutocompleteItem>
        ))}
      </Autocomplete>

      <Spacer y={2} />

      <Select
        label="Operation"
        placeholder="Select operation"
        labelPlacement="outside"
        onSelectionChange={(keys) => onUpdateCdc({ yAxisOperation: keys.currentKey })}
        selectedKeys={[cdc.yAxisOperation || ""]}
        selectionMode="single"
        aria-label="Select an operation"
      >
        {operations.map((option) => (
          <SelectItem key={option.value} textValue={option.text}>
            {option.text}
          </SelectItem>
        ))}
      </Select>

      <Spacer y={4} />

      <Autocomplete
        label="Date field"
        labelPlacement="outside"
        placeholder="Select a field"
        selectedKey={cdc.dateField || ""}
        onSelectionChange={(key) => onUpdateCdc({ dateField: key })}
        isLoading={loadingFields}
        aria-label="Select a date field used for filtering"
        description="Used for time-based filtering"
      >
        {getDateFieldOptions().map((option) => (
          <AutocompleteItem
            key={option.value}
            startContent={(
              <Chip size="sm" variant="flat" className={"min-w-[70px] text-center"} color={option.label.color}>{option.label.content}</Chip>
            )}
            textValue={option.text}
          >
            {option.text}
          </AutocompleteItem>
        ))}
      </Autocomplete>

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <div className="font-bold">Filters</div>
      <Spacer y={2} />

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
