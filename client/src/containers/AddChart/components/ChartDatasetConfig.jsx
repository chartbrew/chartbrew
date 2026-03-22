import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Avatar,
  Button, Checkbox, Chip, Divider, Input, Link, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Popover, PopoverContent,
  PopoverTrigger, ScrollShadow, Spacer, Spinner, Tab, Tabs, Tooltip, commonColors,
} from "@heroui/react";
import { TbMathFunctionY, TbProgressCheck } from "react-icons/tb";
import { TwitterPicker, SketchPicker } from "react-color";
import { useNavigate, useParams } from "react-router";
import {
  LuArrowDown01, LuArrowDown10, LuCircleCheck, LuInfo,
  LuPlug,
  LuWandSparkles, LuCircleX,
  LuVariable,
} from "react-icons/lu";

import Text from "../../../components/Text";
import Row from "../../../components/Row";
import { removeCdc, runQuery, selectCdc, updateCdc } from "../../../slices/chart";
import DatasetAlerts from "./DatasetAlerts";
import { chartColors, primary } from "../../../config/colors";
import { flatMap } from "lodash";
import TableConfiguration from "../../../components/TableConfiguration";
import FormulaTips from "../../../components/FormulaTips";
import canAccess from "../../../config/canAccess";
import { selectTeam } from "../../../slices/team";
import { selectUser } from "../../../slices/user";
import connectionImages from "../../../config/connectionImages";
import { useTheme } from "../../../modules/ThemeContext";
import ChartDatasetDataSetup from "./ChartDatasetDataSetup";
import getDatasetDisplayName from "../../../modules/getDatasetDisplayName";

function ChartDatasetConfig(props) {
  const { chartId, cdcId, dataRequests, onRemove } = props;

  const [legend, setLegend] = useState("");
  const [formula, setFormula] = useState("");
  const [maxRecords, setMaxRecords] = useState("");
  const [goal, setGoal] = useState("");
  const [dataItems, setDataItems] = useState({});
  const [tableFields, setTableFields] = useState([]);
  const [editConfirmation, setEditConfirmation] = useState(false);
  const [variables, setVariables] = useState([]);
  const [variableValues, setVariableValues] = useState({});
  const [activeTab, setActiveTab] = useState("data-setup");

  const cdc = useSelector((state) => selectCdc(state, chartId, cdcId));
  const dataset = useSelector((state) => (
    cdc?.dataset_id
      ? state.dataset.data.find((d) => d.id === parseInt(cdc.dataset_id, 10))
      : null
  ));
  const drs = dataset?.DataRequests || [];
  const chart = useSelector((state) => state.chart.data.find((c) => c.id === chartId));
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);

  const dispatch = useDispatch();
  const params = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  useEffect(() => {
    setFormula(cdc?.formula || "");
    setLegend(cdc?.legend || getDatasetDisplayName(dataset));
    setMaxRecords(cdc?.maxRecords || "");
    setGoal(cdc?.goal || "");
  }, [cdc, dataset]);

  useEffect(() => {
    let tempVariables = [];
    if (drs && Array.isArray(drs)) {
      const variableByName = {};
      drs.forEach((dr) => {
        if (dr?.VariableBindings && Array.isArray(dr.VariableBindings)) {
          dr.VariableBindings.forEach((vb) => {
            if (vb?.name && !variableByName[vb.name]) {
              variableByName[vb.name] = vb;
            }
          });
        }
      });
      tempVariables = Object.values(variableByName);
    }
    setVariables(tempVariables);

    const existingValues = {};
    if (cdc?.configuration?.variables) {
      cdc.configuration.variables.forEach((configVar) => {
        existingValues[configVar.name] = configVar.value;
      });
    }

    const initialValues = {};
    tempVariables.forEach((variable) => {
      initialValues[variable.name] = existingValues[variable.name] || variable.default_value || "";
    });

    setVariableValues(initialValues);
  }, [drs, cdc?.id, cdc?.configuration]);

  useEffect(() => {
    let tempDataItems;
    if (cdc?.id && chart?.chartData?.data?.datasets) {
      let foundIndex;
      for (let i = 0; i < chart.ChartDatasetConfigs.length; i++) {
        const config = chart.ChartDatasetConfigs[i];
        if (config.id === cdc.id) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex || foundIndex === 0) {
        tempDataItems = chart.chartData.data.datasets[foundIndex];
        tempDataItems = {
          ...tempDataItems,
          labels: chart.chartData.data.labels,
        };

        setDataItems(tempDataItems);
      }
    }
  }, [chart, cdc]);

  useEffect(() => {
    if (cdc?.id && chart?.type === "table" && chart?.chartData && chart.chartData[cdc.legend]) {
      const datasetData = chart.chartData[cdc.legend];
      const flatColumns = flatMap(datasetData.columns, (field) => {
        if (field.columns) return [field, ...field.columns];
        return field;
      });

      setTableFields(flatColumns);
    }
  }, [chart?.chartData, chart?.type, cdc?.id, cdc?.legend]);

  const _onRunQuery = (skipParsing = true) => {
    dispatch(runQuery({
      project_id: params.projectId,
      chart_id: chartId,
      cdc_id: cdc.id,
      noSource: true,
      skipParsing: chart?.type === "matrix" ? false : skipParsing,
      getCache: true,
    }));
  };

  const _onUpdateCdc = (data) => {
    let skipParsing = true;

    Object.keys(data).forEach((key) => {
      if (
        key === "xAxis"
        || key === "xAxisOperation"
        || key === "yAxis"
        || key === "yAxisOperation"
        || key === "dateField"
        || key === "dateFormat"
        || key === "conditions"
        || key === "formula"
        || key === "sort"
        || key === "maxRecords"
        || key === "goal"
        || key === "configuration"
        || key === "variables"
      ) {
        skipParsing = false;
      }
    });

    dispatch(updateCdc({
      project_id: params.projectId,
      chart_id: chartId,
      cdc_id: cdc.id,
      data,
    }))
      .then(() => {
        _onRunQuery(skipParsing);
      });
  };

  const _onSaveLegend = () => {
    dispatch(updateCdc({
      project_id: params.projectId,
      chart_id: chartId,
      cdc_id: cdc.id,
      data: { legend },
    })).then(() => {
      _onRunQuery(true);
    });
  };

  const _getDatasetColor = (datasetColor) => ({
    cursor: "pointer",
    backgroundColor: datasetColor === "rgba(0,0,0,0)" ? primary : datasetColor,
    border: `1px solid ${commonColors.zinc[500]}`,
  });

  const _onChangeDatasetColor = (color) => {
    _onUpdateCdc({ datasetColor: color.hex });
  };

  const _onChangeFillColor = (color, fillIndex) => {
    const rgba = `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`;

    if (!fillIndex && fillIndex !== 0) {
      _onUpdateCdc({ fillColor: [rgba] });
    } else {
      const newFillColor = [...cdc.fillColor];
      if (Array.isArray(newFillColor)) {
        newFillColor[fillIndex] = rgba;
      }
      _onUpdateCdc({ fillColor: newFillColor });
    }
  };

  const _onChangeMultiFill = () => {
    if (!cdc.multiFill) {
      let newFillColor = cdc.fillColor;
      if (!Array.isArray(newFillColor) || !newFillColor.length) {
        newFillColor = [newFillColor];
      } else {
        newFillColor = [...newFillColor];
      }

      newFillColor = newFillColor.map((color, index) => {
        if (!color) {
          return Object.values(chartColors)[index % Object.values(chartColors).length].hex;
        }
        return color;
      });

      if (dataItems?.labels && newFillColor.length < dataItems.labels.length) {
        for (let i = newFillColor.length; i < dataItems.labels.length; i++) {
          newFillColor.push(Object.values(chartColors)[i % Object.values(chartColors).length].hex);
        }
      }

      _onUpdateCdc({ multiFill: true, fillColor: newFillColor });
    } else {
      const firstValidColor = cdc.fillColor.find((color) => color) || Object.values(chartColors)[0].hex;
      _onUpdateCdc({ multiFill: false, fillColor: firstValidColor });
    }
  };

  const _onRemoveCdc = async () => {
    onRemove(cdc.id);

    await dispatch(removeCdc({
      project_id: params.projectId,
      chart_id: chartId,
      cdc_id: cdc.id,
    }));

    await dispatch(runQuery({
      project_id: chart.project_id,
      chart_id: chartId,
      noSource: false,
      skipParsing: false,
      getCache: true,
    }));
  };

  const _onUpdateTableConfig = (data) => {
    _onUpdateCdc(data);
  };

  const _onAddFormula = () => {
    setFormula("{val}");
  };

  const _onExampleFormula = () => {
    setFormula("${val / 100}");
    _onUpdateCdc({ formula: "${val / 100}" });
  };

  const _onRemoveFormula = () => {
    setFormula("");
    _onUpdateCdc({ formula: "" });
  };

  const _onApplyFormula = () => {
    _onUpdateCdc({ formula });
  };

  const _onSaveVariableValue = (variableName, value) => {
    const currentConfig = cdc.configuration || {};
    const currentVariables = currentConfig.variables || [];
    const updatedVariables = [...currentVariables];
    const existingIndex = updatedVariables.findIndex((variable) => variable.name === variableName);

    if (existingIndex >= 0) {
      updatedVariables[existingIndex] = { name: variableName, value };
    } else {
      updatedVariables.push({ name: variableName, value });
    }

    const updatedConfig = {
      ...currentConfig,
      variables: updatedVariables,
    };

    _onUpdateCdc({ configuration: updatedConfig });

    setVariableValues((prev) => ({
      ...prev,
      [variableName]: value,
    }));
  };

  const _getVariableCurrentValue = (variable) => {
    return variableValues[variable.name] || variable.default_value || "";
  };

  const _getVariableOriginalValue = (variable) => {
    const overrideValue = cdc.configuration?.variables?.find((item) => item.name === variable.name)?.value;
    return overrideValue !== undefined ? overrideValue : (variable.default_value || "");
  };

  const _hasVariableChanged = (variable) => {
    const currentValue = variableValues[variable.name] || "";
    const originalValue = _getVariableOriginalValue(variable);
    return currentValue !== originalValue;
  };

  const _onClearVariableOverride = (variableName) => {
    const currentConfig = cdc.configuration || {};
    const currentVariables = currentConfig.variables || [];
    const updatedVariables = currentVariables.filter((variable) => variable.name !== variableName);

    const updatedConfig = {
      ...currentConfig,
      variables: updatedVariables,
    };

    _onUpdateCdc({ configuration: updatedConfig });

    const variable = variables.find((item) => item.name === variableName);
    setVariableValues((prev) => ({
      ...prev,
      [variableName]: variable?.default_value || "",
    }));
  };

  const _onEditDataset = () => {
    setEditConfirmation(true);
  };

  if (!cdc?.id) {
    return (
      <div className="flex flex-col items-center justify-center mt-8">
        <Spinner variant="simple" />
      </div>
    );
  }

  const seriesLabel = cdc.legend || getDatasetDisplayName(dataset) || "Untitled series";

  return (
    <div>
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key)}
        aria-label="Series configuration"
        fullWidth
      >
        <Tab key="data-setup" title="Data setup">
          <Spacer y={4} />
          <ChartDatasetDataSetup
            cdc={cdc}
            dataset={dataset}
            chart={chart}
            teamId={team?.id}
            legend={legend}
            onSaveLegend={{
              onChange: (event) => setLegend(event.target.value),
              onSave: _onSaveLegend,
            }}
            onUpdateCdc={_onUpdateCdc}
            onEditDataset={_onEditDataset}
          />
        </Tab>

        <Tab key="display" title="Display">
          <Spacer y={4} />

          {chart.type !== "table" && (
            <>
              <div className="chart-cdc-colors">
                <div className="font-bold">{"Series colors"}</div>
                <Spacer y={2} />

                <div className="flex flex-row justify-between items-center">
                  <div className="text-sm">Primary color</div>
                  <div>
                    <Popover>
                      <PopoverTrigger>
                        <Chip
                          style={_getDatasetColor(cdc.datasetColor)}
                          size="lg"
                          radius="sm"
                          className="pl-[100px]"
                        />
                      </PopoverTrigger>
                      <PopoverContent className="border-none bg-transparent shadow-none">
                        <TwitterPicker
                          triangle={"hide"}
                          color={cdc.datasetColor}
                          colors={Object.values(chartColors).map((color) => color.hex)}
                          onChangeComplete={_onChangeDatasetColor}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <Spacer y={2} />

                {chart.type !== "matrix" && (
                  <Row align={"center"} justify={"space-between"}>
                    <Row align={"center"}>
                      <Checkbox
                        isSelected={cdc.fill}
                        onChange={() => _onUpdateCdc({ fill: !cdc.fill, fillColor: ["transparent"] })}
                        isDisabled={cdc.multiFill}
                        size="sm"
                      >
                        Fill Color
                      </Checkbox>
                    </Row>
                    {cdc.fill && !cdc.multiFill && (
                      <div>
                        <Popover>
                          <PopoverTrigger>
                            <Chip
                              style={_getDatasetColor(Array.isArray(cdc.fillColor) ? cdc.fillColor[0] : cdc.fillColor)}
                              size="lg"
                              radius="sm"
                              className="pl-[100px]"
                            />
                          </PopoverTrigger>
                          <PopoverContent className="border-none bg-transparent shadow-none">
                            <SketchPicker
                              color={Array.isArray(cdc.fillColor) ? cdc.fillColor[0] : cdc.fillColor}
                              presetColors={Object.values(chartColors).map((color) => color.hex)}
                              onChangeComplete={(color) => _onChangeFillColor(color)}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </Row>
                )}
                <Spacer y={2} />

                {chart.type !== "line" && chart.type !== "matrix" && (
                  <Row>
                    <Checkbox
                      isSelected={cdc.multiFill}
                      onChange={() => _onChangeMultiFill()}
                      size="sm"
                    >
                      Multiple colors
                    </Checkbox>
                  </Row>
                )}

                {chart.type !== "line" && chart.type !== "matrix" && cdc.multiFill && (
                  <>
                    <Spacer y={2} />
                    <ScrollShadow className="max-h-[300px] border-2 border-solid border-content3 rounded-md p-2">
                      {dataItems?.labels?.map((label, index) => (
                        <Row key={label} justify={"space-between"}>
                          <Text size="sm">{label}</Text>
                          <div>
                            <Popover>
                              <PopoverTrigger>
                                <Chip
                                  style={_getDatasetColor(cdc.fillColor[index] || "white")}
                                  radius="sm"
                                />
                              </PopoverTrigger>
                              <PopoverContent className="border-none bg-transparent shadow-none">
                                <TwitterPicker
                                  triangle={"hide"}
                                  color={cdc.fillColor[index] || "white"}
                                  colors={Object.values(chartColors).map((color) => color.hex)}
                                  onChangeComplete={(color) => _onChangeFillColor(color, index)}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </Row>
                      ))}
                    </ScrollShadow>
                    <Spacer y={2} />
                  </>
                )}
              </div>

              <Spacer y={4} />
              <Divider />
              <Spacer y={4} />
            </>
          )}

          {chart.type !== "table" && chart.type !== "matrix" && (
            <>
              <Row>
                <Text b>{"Series settings"}</Text>
              </Row>
              <Spacer y={1} />
              <div className="flex flex-col gap-2">
                <div className="text-sm">Sort records</div>
                <div className="flex flex-row gap-2">
                  <Tooltip content="Sort the dataset in ascending order">
                    <Button
                      color={cdc.sort === "asc" ? "secondary" : "default"}
                      variant="flat"
                      onPress={() => _onUpdateCdc({ sort: cdc.sort === "asc" ? "" : "asc" })}
                      startContent={<LuArrowDown01 />}
                      fullWidth
                      size="sm"
                    >
                      Asc
                    </Button>
                  </Tooltip>
                  <Tooltip content="Sort the dataset in descending order">
                    <Button
                      color={cdc.sort === "desc" ? "secondary" : "default"}
                      variant="flat"
                      onPress={() => _onUpdateCdc({ sort: cdc.sort === "desc" ? "" : "desc" })}
                      startContent={<LuArrowDown10 />}
                      fullWidth
                      size="sm"
                    >
                      Desc
                    </Button>
                  </Tooltip>
                  {cdc.sort && (
                    <>
                      <Tooltip content="Clear sorting">
                        <Link className="text-danger" onPress={() => _onUpdateCdc({ sort: "" })}>
                          <LuCircleX className="text-danger" />
                        </Link>
                      </Tooltip>
                    </>
                  )}
                </div>
              </div>
              <Spacer y={4} />

              <div className="flex flex-col gap-2">
                <div className="text-sm">Max records</div>
                <div className="flex flex-row gap-2">
                  <Input
                    labelPlacement="outside"
                    placeholder="Max records"
                    value={maxRecords}
                    onChange={(event) => setMaxRecords(event.target.value)}
                    type="number"
                    min={1}
                    fullWidth
                    description="Limit the number of records shown"
                  />
                  {maxRecords && (
                    <>
                      {`${maxRecords}` !== `${cdc.maxRecords || ""}` && (
                        <>
                          <Tooltip content="Save">
                            <Link className="text-success" onPress={() => _onUpdateCdc({ maxRecords })}>
                              <LuCircleCheck className="text-success" />
                            </Link>
                          </Tooltip>
                        </>
                      )}
                      <Tooltip content="Clear limit">
                        <Link
                          className="text-danger"
                          onPress={() => {
                            _onUpdateCdc({ maxRecords: null });
                            setMaxRecords("");
                          }}
                        >
                          <LuCircleX className="text-danger" />
                        </Link>
                      </Tooltip>
                    </>
                  )}
                </div>
              </div>

              <Spacer y={4} />
              <Divider />
              <Spacer y={4} />
            </>
          )}

          {chart.type === "table" && (
            <TableConfiguration
              dataset={cdc}
              chartData={chart.chartData}
              tableFields={tableFields}
              onUpdate={_onUpdateTableConfig}
              loading={false}
            />
          )}

          {chart.type !== "table" && (
            <>
              <div>
                {!formula && (
                  <Link onPress={_onAddFormula} className="flex items-center cursor-pointer chart-cdc-formula">
                    <TbMathFunctionY size={24} />
                    <Spacer x={1} />
                    <div className="text-sm text-foreground">Apply formula on metrics</div>
                  </Link>
                )}
                {formula && (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col">
                      <Popover>
                        <PopoverTrigger>
                          <div className="flex flex-row gap-1 items-center cursor-pointer">
                            <div className="text-sm">{"Metric formula"}</div>
                            <LuInfo size={16} />
                          </div>
                        </PopoverTrigger>
                        <PopoverContent>
                          <FormulaTips />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex flex-row gap-3 items-center w-full">
                        <Input
                          labelPlacement="outside"
                          placeholder="Enter your formula here: {val}"
                          value={formula}
                          onChange={(event) => setFormula(event.target.value)}
                          variant="bordered"
                          fullWidth
                        />
                        {formula !== cdc.formula && (
                          <Tooltip content={"Apply the formula"}>
                            <Link onPress={_onApplyFormula}>
                              <LuCircleCheck className={"text-success"} />
                            </Link>
                          </Tooltip>
                        )}
                        <Tooltip content="Remove formula">
                          <Link onPress={_onRemoveFormula}>
                            <LuCircleX className="text-danger" />
                          </Link>
                        </Tooltip>
                        <Tooltip content="Click for an example">
                          <Link onPress={_onExampleFormula}>
                            <LuWandSparkles className="text-primary" />
                          </Link>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Spacer y={4} />
              <Divider />
              <Spacer y={4} />

              <div>
                {!goal && (
                  <div>
                    <Link onPress={() => setGoal(1000)} className="flex items-center cursor-pointer chart-cdc-goal">
                      <TbProgressCheck size={24} />
                      <Spacer x={1} />
                      <div className="text-sm text-foreground">Set a goal</div>
                    </Link>
                  </div>
                )}
                {goal && (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-row gap-2 items-center">
                      <div className="text-sm text-foreground">{"Goal"}</div>
                      <Tooltip className="max-w-sm" content="A goal can be displayed as a progress bar in your KPI charts. Enter a number without any other characters. (e.g. 1000 instead of 1k)">
                        <div><LuInfo size={16} /></div>
                      </Tooltip>
                    </div>
                    <div className="flex flex-row gap-2 items-center">
                      <Input
                        placeholder="Enter your goal here"
                        value={goal}
                        onChange={(event) => setGoal(event.target.value)}
                        variant="bordered"
                        labelPlacement="outside"
                      />
                      {`${goal}` !== `${cdc.goal || ""}` && (
                        <Tooltip content={"Save goal"}>
                          <Link onPress={() => _onUpdateCdc({ goal })}>
                            <LuCircleCheck className={"text-success"} />
                          </Link>
                        </Tooltip>
                      )}
                      <Tooltip content="Remove goal">
                        <Link onPress={() => {
                          _onUpdateCdc({ goal: null });
                          setGoal("");
                        }}>
                          <LuCircleX className="text-danger" />
                        </Link>
                      </Tooltip>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </Tab>

        <Tab key="automation" title="Automation">
          <Spacer y={4} />

          <Row>
            <DatasetAlerts
              chartType={chart.type === "pie"
                || chart.type === "radar"
                || chart.type === "polar"
                || chart.type === "doughnut"
                || chart.type === "table"
                ? "patterns" : "axis"}
              chartId={params.chartId}
              cdcId={cdc.id}
              projectId={params.projectId}
            />
          </Row>

          <Spacer y={4} />
          <Divider />
          <Spacer y={4} />

          <div className="flex flex-col gap-2">
            <div className="font-bold">{"Variables"}</div>
            {variables.map((variable) => (
              <div key={variable.id} className="flex flex-col gap-1">
                <Input
                  startContent={(
                    <div className="flex flex-row gap-1 items-center">
                      <LuVariable size={18} />
                      <div className="text-sm text-gray-400">{variable.name}</div>
                    </div>
                  )}
                  placeholder={`Default: ${variable.default_value || "No default"}`}
                  value={_getVariableCurrentValue(variable)}
                  onChange={(event) => {
                    setVariableValues((prev) => ({
                      ...prev,
                      [variable.name]: event.target.value,
                    }));
                  }}
                  variant="bordered"
                  endContent={
                    _hasVariableChanged(variable) ? (
                      <div className="flex flex-row gap-1">
                        <Tooltip content="Save variable value">
                          <Link
                            onClick={() => _onSaveVariableValue(variable.name, variableValues[variable.name] || "")}
                            className="text-success"
                          >
                            <LuCircleCheck className="text-success" />
                          </Link>
                        </Tooltip>
                        <Tooltip content="Reset to saved value">
                          <Link
                            onClick={() => {
                              const originalValue = _getVariableOriginalValue(variable);
                              setVariableValues((prev) => ({
                                ...prev,
                                [variable.name]: originalValue,
                              }));
                            }}
                            className="text-warning"
                          >
                            <LuCircleX className="text-warning" />
                          </Link>
                        </Tooltip>
                      </div>
                    ) : cdc.configuration?.variables?.find((item) => item.name === variable.name) && (
                      <div className="flex flex-row gap-1">
                        <Tooltip content="Remove override and use default value">
                          <Link onClick={() => _onClearVariableOverride(variable.name)}>
                            <LuCircleX className="text-warning" />
                          </Link>
                        </Tooltip>
                      </div>
                    )
                  }
                />
              </div>
            ))}
            {variables.length === 0 && (
              <div className="text-sm text-gray-400 italic">
                {"No variables found in the connected datasets."}
              </div>
            )}
          </div>
        </Tab>
      </Tabs>

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <div className="flex flex-row justify-between">
        {canAccess("teamAdmin", user.id, team?.TeamRoles) && (
          <div className="flex flex-row gap-2 items-center">
            {dataRequests?.map((dr) => (
              <Tooltip content={dr?.Connection?.name} key={dr.id}>
                <Avatar
                  src={connectionImages(isDark)[dr?.Connection?.subType]}
                  isBordered
                  size="sm"
                />
              </Tooltip>
            ))}
            {dataRequests?.length > 0 && <div><LuPlug /></div>}
          </div>
        )}

        <Button
          variant="faded"
          color="danger"
          size="sm"
          onPress={_onRemoveCdc}
        >
          {`Remove ${seriesLabel}`}
        </Button>
      </div>

      <Modal isOpen={editConfirmation} onClose={() => setEditConfirmation(false)}>
        <ModalContent>
          <ModalHeader>Edit dataset?</ModalHeader>
          <ModalBody>
            <Text>
              {"You are about to edit the dataset. This will affect all charts that use this dataset. Are you sure you want to continue?"}
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setEditConfirmation(false)}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={() => {
                setEditConfirmation(false);
                navigate(`/datasets/${cdc.dataset_id}?project_id=${params.projectId}&chart_id=${chartId}`);
              }}
            >
              Continue
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

ChartDatasetConfig.propTypes = {
  chartId: PropTypes.number.isRequired,
  dataRequests: PropTypes.array,
  cdcId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onRemove: PropTypes.func.isRequired,
};

ChartDatasetConfig.defaultProps = {
  dataRequests: [],
};

export default ChartDatasetConfig;
