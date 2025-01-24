import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useParams } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { TbMathFunctionY } from "react-icons/tb";
import { LuCircleCheck, LuInfo, LuWandSparkles, LuCircleX } from "react-icons/lu";

import ChartPreview from "../AddChart/components/ChartPreview";
import Row from "../../components/Row";
import { Autocomplete, AutocompleteItem, Chip, Divider, Input, Link, Popover, PopoverContent, PopoverTrigger, Select, SelectItem, Spacer, Tooltip } from "@heroui/react";
import Text from "../../components/Text";
import autoFieldSelector from "../../modules/autoFieldSelector";
import fieldFinder from "../../modules/fieldFinder";
import { updateDataset } from "../../slices/dataset";
import { operations } from "../../modules/filterOperations";
import { runQuery, updateChart } from "../../slices/chart";
import FormulaTips from "../../components/FormulaTips";
import DatasetFilters from "../../components/DatasetFilters";
import ChartSettings from "../AddChart/components/ChartSettings";
import { updateCdc } from "../../slices/chart";


function DatasetBuilder(props) {
  const { chart, projectId } = props;

  const [fieldOptions, setFieldOptions] = useState([]);
  const [formula, setFormula] = useState("");
  const [useCache, setUseCache] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);

  const params = useParams();
  const dispatch = useDispatch();
  const initRef = useRef(null);
  
  const dataset = useSelector((state) => state.dataset.data.find((d) => `${d.id}` === `${params.datasetId}`));
  const datasetResponse = useSelector((state) => state.dataset.responses.find((r) => r.dataset_id === dataset.id)?.data);

  useEffect(() => {
    if (dataset.formula) {
      setFormula(dataset.formula);
    }
  }, [dataset]);

  useEffect(() => {
    if (chart && dataset && !datasetResponse && !initRef.current) {
      initRef.current = true;
      dispatch(runQuery({
        project_id: projectId,
        chart_id: chart.id,
        noSource: false,
        skipParsing: false,
        getCache: true,
      }))
        .catch(() => {
          toast.error("Could not refresh the dataset. Please check your query.");
        });
    }
  }, [chart, dataset, datasetResponse]);

  useEffect(() => {
    if (datasetResponse) {
      let tempFieldOptions = [];
      const tempObjectOptions = [];
      const fieldsSchema = {};
      const updateObj = {};

      const fields = fieldFinder(datasetResponse);
      const objectFields = fieldFinder(datasetResponse, false, true);

      fields.forEach((o) => {
        if (o.field) {
          let text = o.field && o.field.replace("root[].", "").replace("root.", "");
          if (o.type === "array") text += "(get element count)";
          tempFieldOptions.push({
            key: o.field,
            text: o.field && text,
            value: o.field,
            type: o.type,
            label: {
              style: { width: 55, textAlign: "center" },
              content: o.type || "unknown",
              size: "mini",
              color: o.type === "date" ? "secondary"
                : o.type === "number" ? "primary"
                  : o.type === "string" ? "success"
                    : o.type === "boolean" ? "warning"
                      : "default"
            },
          });
        }
        fieldsSchema[o.field] = o.type;
      });

      objectFields.forEach((obj) => {
        if (obj.field) {
          let text = obj.field && obj.field.replace("root[].", "").replace("root.", "");
          if (obj.type === "array") text += "(get element count)";
          tempObjectOptions.push({
            key: obj.field,
            text: obj.field && text,
            value: obj.field,
            type: obj.type,
            isObject: true,
            label: {
              style: { width: 55, textAlign: "center" },
              content: obj.type || "unknown",
              size: "mini",
              color: obj.type === "date" ? "secondary"
                : obj.type === "number" ? "primary"
                  : obj.type === "string" ? "success"
                    : obj.type === "boolean" ? "warning"
                      : "default"
            },
          });
        }
        fieldsSchema[obj.field] = obj.type;
      });

      if (Object.keys(fieldsSchema).length > 0) updateObj.fieldsSchema = fieldsSchema;

      tempFieldOptions = tempFieldOptions.concat(tempObjectOptions);

      setFieldOptions(tempFieldOptions);

      // initialise values for the user if there were no prior selections
      const autoFields = autoFieldSelector(tempFieldOptions);
      Object.keys(autoFields).forEach((key) => {
        if (!dataset[key]) updateObj[key] = autoFields[key];
      });

      // update the operation only if the xAxis and yAxis were not set initially
      if (!dataset.xAxis && !dataset.yAxis && autoFields.yAxisOperation) {
        updateObj.yAxisOperation = autoFields.yAxisOperation;
      }

      if (Object.keys(updateObj).length > 0) {
        setLoadingFields(true);
        dispatch(updateDataset({
          team_id: dataset.team_id,
          dataset_id: dataset.id,
          data: updateObj,
        }))
          .then(() => {
            return dispatch(runQuery({
              project_id: projectId,
              chart_id: chart.id,
              noSource: false,
              skipParsing: false,
              getCache: true,
            }));
          })
          .then(() => {
            setLoadingFields(false);
          })
          .catch(() => {
            setLoadingFields(false);
          });
      }
    }
  }, [datasetResponse]);

  const _filterOptions = (axis) => {
    let filteredOptions = fieldOptions;
    if (axis === "x" && chart?.type !== "table") {
      filteredOptions = filteredOptions.filter((f) => {
        if (f.type === "array" || (f.value && f.value.split("[]").length > 2)) {
          return false;
        }

        return true;
      });
    }

    if (chart?.type !== "table") return filteredOptions;

    filteredOptions = fieldOptions.filter((f) => f.type === "array");

    if (axis === "x") {
      filteredOptions = filteredOptions.filter((f) => {
        if (f.type === "array" || (f.value && f.value.split("[]").length > 2)) {
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

    const [rootField] = fieldOptions.filter((f) => f.value.indexOf([]) > -1);
    if (rootField) {
      rootObj.text = rootField.value.substring(0, rootField.value.lastIndexOf("."));
      rootObj.key = rootField.value.substring(0, rootField.value.lastIndexOf("."));
      rootObj.value = rootField.value.substring(0, rootField.value.lastIndexOf("."));
    }

    if (!filteredOptions) {
      filteredOptions = [rootObj];
    } else {
      filteredOptions.unshift(rootObj);
    }

    return filteredOptions;
  };

  const _getYFieldOptions = () => {
    return fieldOptions;
  };

  const _getDateFieldOptions = () => {
    let filteredOptions = fieldOptions.filter((f) => f.type === "date");

    return filteredOptions;
  };

  const _onUpdateDataset = (data) => {
    return dispatch(updateDataset({
      team_id: dataset.team_id,
      dataset_id: dataset.id,
      data,
    }))
      .then(() => {
        toast.success("Dataset updated successfully.");
        dispatch(runQuery({
          project_id: projectId,
          chart_id: chart.id,
          noSource: false,
          skipParsing: false,
          getCache: true,
        }));

        return true;
      })
      .catch(() => {
        toast.error("Could not refresh the dataset. Please check your query.");
      });
  };

  const _onRefreshPreview = (getCache = true) => {
    dispatch(runQuery({
      project_id: projectId,
      chart_id: chart.id,
      noSource: false,
      skipParsing: false,
      getCache,
    }))
      .catch(() => {
        toast.error("Could not refresh the dataset. Please check your query.");
      });
  };

  const _onUpdateChart = (data) => {
    dispatch(updateChart({
      project_id: projectId,
      chart_id: chart.id,
      data,
    }))
      .catch(() => {
        toast.error("Could not update the chart. Please check your query.");
      });
  };

  const _onAddFormula = () => {
    setFormula("{val}");
  };

  const _onExampleFormula = () => {
    setFormula("${val / 100}");
    _onUpdateDataset({ formula: "${val / 100}" });
  };

  const _onRemoveFormula = () => {
    setFormula("");
    _onUpdateDataset({ formula: "" });
  };

  const _onApplyFormula = () => {
    _onUpdateDataset({ formula });
    if (chart?.ChartDatasetConfigs?.[0]?.id) {
      dispatch(updateCdc({
        project_id: projectId,
        chart_id: chart.id,
        cdc_id: chart?.ChartDatasetConfigs?.[0]?.id,
        data: { formula },
      }));
    }
  };

  const _onChangeGlobalSettings = ({
    pointRadius, displayLegend, dateRange, includeZeros, timeInterval, currentEndDate,
    fixedStartDate, maxValue, minValue, xLabelTicks, stacked, horizontal, dataLabels,
    dateVarsFormat, isLogarithmic,
  }) => {
    const tempChart = {
      pointRadius: typeof pointRadius !== "undefined" ? pointRadius : chart.pointRadius,
      displayLegend: typeof displayLegend !== "undefined" ? displayLegend : chart.displayLegend,
      startDate: dateRange?.startDate || dateRange?.startDate === null
        ? dateRange.startDate : chart.startDate,
      endDate: dateRange?.endDate || dateRange?.endDate === null
        ? dateRange.endDate : chart.endDate,
      timeInterval: timeInterval || chart.timeInterval,
      includeZeros: typeof includeZeros !== "undefined" ? includeZeros : chart.includeZeros,
      currentEndDate: typeof currentEndDate !== "undefined" ? currentEndDate : chart.currentEndDate,
      fixedStartDate: typeof fixedStartDate !== "undefined" ? fixedStartDate : chart.fixedStartDate,
      minValue: typeof minValue !== "undefined" ? minValue : chart.minValue,
      maxValue: typeof maxValue !== "undefined" ? maxValue : chart.maxValue,
      xLabelTicks: typeof xLabelTicks !== "undefined" ? xLabelTicks : chart.xLabelTicks,
      stacked: typeof stacked !== "undefined" ? stacked : chart.stacked,
      horizontal: typeof horizontal !== "undefined" ? horizontal : chart.horizontal,
      dataLabels: typeof dataLabels !== "undefined" ? dataLabels : chart.dataLabels,
      dateVarsFormat: dateVarsFormat !== "undefined" ? dateVarsFormat : chart.dateVarsFormat,
      isLogarithmic: typeof isLogarithmic !== "undefined" ? isLogarithmic : chart.isLogarithmic,
    };

    let skipParsing = false;
    if (pointRadius
      || displayLegend
      || minValue
      || maxValue
      || xLabelTicks
      || stacked
      || horizontal
    ) {
      skipParsing = true;
    }

    _onChangeChart(tempChart, skipParsing);
  };

  const _onChangeChart = (data, skipParsing) => {
    let shouldSkipParsing = skipParsing;
    return dispatch(updateChart({ project_id: projectId, chart_id: chart.id, data }))
      .then((newData) => {
        if (skipParsing || data.datasetColor || data.fillColor || data.type) {
          shouldSkipParsing = true;
        }

        // run the preview refresh only when it's needed
        _onRefreshPreview(shouldSkipParsing);

        return Promise.resolve(newData);
      })
      .catch((e) => {
        toast.error("Oups! Can't save the chart. Please try again.");
        return Promise.reject(e);
      });
  };

  return (
    <div className="grid grid-cols-12 divide-x-1 dark:divide-x-0 divide-content3 gap-4">
      <div className="col-span-12 md:col-span-4 bg-content1 rounded-lg p-4">
        <Autocomplete
          label="Dimension"
          labelPlacement="outside"
          variant="bordered"
          placeholder="Select a dimension"
          selectedKey={dataset.xAxis}
          onSelectionChange={(key) => _onUpdateDataset({ xAxis: key })}
          isLoading={loadingFields}
          aria-label="Select a dimension"
        >
          {_filterOptions("x").map((option) => (
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
          label="Metric"
          labelPlacement="outside"
          variant="bordered"
          placeholder="Select a metric"
          selectedKey={dataset.yAxis}
          onSelectionChange={(key) => _onUpdateDataset({ yAxis: key })}
          isLoading={loadingFields}
          aria-label="Select a metric"
        >
          {_getYFieldOptions().map((option) => (
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
          placeholder="Select an operation"
          labelPlacement="outside"
          onSelectionChange={(keys) => _onUpdateDataset({ yAxisOperation: keys.currentKey })}
          selectedKeys={[dataset.yAxisOperation]}
          selectionMode="single"
          variant="bordered"
          renderValue={(
            <Text>
              {(dataset.yAxisOperation
                && operations.find((i) => i.value === dataset.yAxisOperation).text
              )
                || "Operation"}
            </Text>
          )}
          aria-label="Select an operation"
        >
          {operations.map((option) => (
            <SelectItem key={option.value} textValue={option.text}>
              {option.text}
            </SelectItem>
          ))}
        </Select>
        <Spacer y={4} />
        <Divider />
        <Spacer y={4} />
        <Row align="center" className={"justify-between"}>
          <Autocomplete
            label="Select a date field used for filtering"
            labelPlacement="outside"
            variant="bordered"
            placeholder="Select a field"
            selectedKey={dataset.dateField}
            onSelectionChange={(key) => _onUpdateDataset({ dateField: key })}
            isLoading={loadingFields}
            aria-label="Select a date field used for filtering"
          >
            {_getDateFieldOptions().map((option) => (
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
        </Row>

        <Spacer y={4} />
        <Divider />
        <Spacer y={4} />

        {!formula && (
          <Link onClick={_onAddFormula} className="flex items-center cursor-pointer">
            <TbMathFunctionY size={24} />
            <Spacer x={0.5} />
            <Text>Apply formula on metrics</Text>
          </Link>
        )}
        {formula && (
          <>
            <div className="flex flex-col">
              <Popover>
                <PopoverTrigger>
                  <div className="flex flex-row gap-1 items-center cursor-pointer">
                    <span className="text-sm">
                      {"Metric formula"}
                    </span>
                    <LuInfo size={18} className="hover:text-primary" />
                  </div>
                </PopoverTrigger>
                <PopoverContent>
                  <FormulaTips />
                </PopoverContent>
              </Popover>
            </div>
            <Spacer y={1} />
            <Row align={"center"} justify={"space-between"}>
              <div className="flex flex-col">
                <div className="flex flex-row gap-3 items-center w-full">
                  <Input
                    labelPlacement="outside"
                    placeholder="Enter your formula here: {val}"
                    value={formula}
                    onChange={(e) => setFormula(e.target.value)}
                    variant="bordered"
                    fullWidth
                  />
                  {formula !== dataset.formula && (
                    <Tooltip
                      content={"Apply the formula"}
                    >
                      <Link onClick={_onApplyFormula}>
                        <LuCircleCheck className={"text-success"} />
                      </Link>
                    </Tooltip>
                  )}
                  <Tooltip content="Remove formula">
                    <Link onClick={_onRemoveFormula}>
                      <LuCircleX className="text-danger" />
                    </Link>
                  </Tooltip>
                  <Tooltip content="Click for an example">
                    <Link onClick={_onExampleFormula}>
                      <LuWandSparkles className="text-primary" />
                    </Link>
                  </Tooltip>
                </div>
              </div>
            </Row>
          </>
        )}

        <Spacer y={4} />
        <Divider />
        <Spacer y={4} />

        <div className="">
          Filter settings
        </div>
        <Spacer y={2} />

        <DatasetFilters
          onUpdate={_onUpdateDataset}
          fieldOptions={fieldOptions}
          dataset={dataset}
        />
      </div>

      <div className="col-span-12 md:col-span-8 pl-4">
        <ChartPreview
          chart={chart}
          onRefreshPreview={() => _onRefreshPreview()}
          onRefreshData={() => _onRefreshPreview(useCache)}
          onChange={(data) => _onUpdateChart(data)}
          changeCache={() => setUseCache(!useCache)}
          useCache={useCache}
        />
        
        <Spacer y={4} />

        {chart?.id && (
          <ChartSettings
            chart={chart}
            onChange={_onChangeGlobalSettings}
            onComplete={(skipParsing = false) => _onRefreshPreview(skipParsing)}
          />
        )}
      </div>
    </div>
  );
}

DatasetBuilder.propTypes = {
  chart: PropTypes.object,
  projectId: PropTypes.number.isRequired,
};

DatasetBuilder.defaultProps = {
  chart: {},
};

export default DatasetBuilder
