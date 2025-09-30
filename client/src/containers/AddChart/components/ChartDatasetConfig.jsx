import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Avatar,
  Button, Checkbox, Chip, Divider, Input, Link, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Popover, PopoverContent,
  PopoverTrigger, ScrollShadow, Spacer, Tooltip, commonColors,
} from "@heroui/react";
import { TbMathFunctionY, TbProgressCheck } from "react-icons/tb";
import { TwitterPicker, SketchPicker } from "react-color";
import { useNavigate, useParams } from "react-router";
import { Link as LinkNext } from "react-router";
import {
  LuArrowDown01, LuArrowDown10, LuCheck, LuCircleCheck, LuInfo,
  LuListFilter,
  LuPlug,
  LuSettings,
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

function ChartDatasetConfig(props) {
  const { chartId, cdcId, dataRequests } = props;

  const [legend, setLegend] = useState("");
  const [formula, setFormula] = useState("");
  const [maxRecords, setMaxRecords] = useState("");
  const [goal, setGoal] = useState("");
  const [dataItems, setDataItems] = useState({});
  const [tableFields, setTableFields] = useState([]);
  const [editConfirmation, setEditConfirmation] = useState(false);
  const [variables, setVariables] = useState([]);
  const [variableValues, setVariableValues] = useState({});

  const cdc = useSelector((state) => selectCdc(state, chartId, cdcId));
  const drs = useSelector((state) => state.dataset.data.find((d) => d.id === parseInt(cdc.dataset_id, 10))?.DataRequests);

  const chart = useSelector((state) => state.chart.data.find((c) => c.id === chartId));
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);

  const dispatch = useDispatch();
  const params = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const initVars = useRef(false);

  useEffect(() => {
    if (cdc.formula) {
      setFormula(cdc.formula);
    }
    if (cdc.legend) {
      setLegend(cdc.legend);
    }
    if (cdc.maxRecords) {
      setMaxRecords(cdc.maxRecords);
    }
    if (cdc.goal) {
      setGoal(cdc.goal);
    }
  }, [cdc]);

  useEffect(() => {
    if (drs && !initVars.current) {
      initVars.current = true;
      let tempVariables = [];
      drs?.forEach((dr) => {
        if (dr?.VariableBindings) {
          tempVariables = [...tempVariables, ...dr.VariableBindings];
        }
      });
      setVariables(tempVariables);

      // Load existing variable values from CDC configuration
      const existingValues = {};
      if (cdc.configuration?.variables) {
        cdc.configuration.variables.forEach((configVar) => {
          existingValues[configVar.name] = configVar.value;
        });
      }
      
      // Initialize variable values with existing overrides or default values
      const initialValues = {};
      tempVariables.forEach((variable) => {
        initialValues[variable.name] = existingValues[variable.name] || variable.default_value || "";
      });
      
      setVariableValues(initialValues);
    }
  }, [drs, cdc.configuration]);

  useEffect(() => {
    let tempDataItems;
    if (chart.chartData && chart.chartData.data && chart.chartData.data.datasets) {
      // find the dataset in the chart data
      let foundIndex;
      for (let i = 0; i < chart.ChartDatasetConfigs.length; i++) {
        const d = chart.ChartDatasetConfigs[i];
        if (d.id === cdc.id) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex || foundIndex === 0) {
        tempDataItems = chart.chartData.data.datasets[foundIndex];
        tempDataItems = {
          ...tempDataItems,
          labels: chart.chartData.data && chart.chartData.data.labels
        };

        setDataItems(tempDataItems);
      }
    }
  }, [chart, cdc]);

  useEffect(() => {
    // extract the table fields if table view is selected
    if (chart.type === "table" && chart.chartData && chart.chartData[cdc.legend]) {
      const datasetData = chart.chartData[cdc.legend];
      const flatColumns = flatMap(datasetData.columns, (f) => {
        if (f.columns) return [f, ...f.columns];
        return f;
      });

      setTableFields(flatColumns);
    }
  }, [chart.chartData]);

  const _onRunQuery = (skipParsing = true) => {
    dispatch(runQuery({
      project_id: params.projectId,
      chart_id: chartId,
      cdc_id: cdc.id,
      noSource: true,
      skipParsing,
      getCache: true
    }));
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

  const _onSaveLegend = () => {
    dispatch(updateCdc({
      project_id: params.projectId,
      chart_id: chartId,
      cdc_id: cdc.id,
      data: { legend },
    }));
  };

  const _onUpdateCdc = (data) => {
    let skipParsing = true;

    Object.keys(data).forEach((key) => {
      if (key === "formula" || key === "sort" || key === "maxRecords" || key === "goal" || key === "configuration") {
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

  const _getDatasetColor = (datasetColor) => ({
    cursor: "pointer",
    backgroundColor: datasetColor === "rgba(0,0,0,0)" ? primary : datasetColor,
    border: `1px solid ${commonColors.zinc[500]}`
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

      // Replace any null/undefined values with colors
      newFillColor = newFillColor.map((color, i) => {
        if (!color) {
          return Object.values(chartColors)[i % Object.values(chartColors).length].hex;
        }
        return color;
      });

      // Add additional colors if needed
      if (dataItems?.labels && newFillColor.length < dataItems.labels.length) {
        for (let i = newFillColor.length; i < dataItems.labels.length; i++) {
          newFillColor.push(Object.values(chartColors)[i % Object.values(chartColors).length].hex);
        }
      }

      _onUpdateCdc({ multiFill: true, fillColor: newFillColor });
    } else {
      const firstValidColor = cdc.fillColor.find(c => c) || Object.values(chartColors)[0].hex;
      _onUpdateCdc({ multiFill: false, fillColor: firstValidColor });
    }
  };

  const _onRemoveCdc = () => {
    dispatch(removeCdc({
      project_id: params.projectId,
      chart_id: chartId,
      cdc_id: cdc.id,
    }))
      .then(() => {
        dispatch(runQuery({
          project_id: params.projectId,
          chart_id: chartId,
          noSource: false,
          skipParsing: false,
          getCache: true,
        }));
      });
  };

  const _onUpdateTableConfig = (data) => {
    _onUpdateCdc(data);
  };

  const _onSaveVariableValue = (variableName, value) => {
    // Get current configuration or initialize empty object
    const currentConfig = cdc.configuration || {};
    const currentVariables = currentConfig.variables || [];
    
    // Update or add the variable value
    const updatedVariables = [...currentVariables];
    const existingIndex = updatedVariables.findIndex(v => v.name === variableName);
    
    if (existingIndex >= 0) {
      updatedVariables[existingIndex] = { name: variableName, value };
    } else {
      updatedVariables.push({ name: variableName, value });
    }
    
    // Update the configuration
    const updatedConfig = {
      ...currentConfig,
      variables: updatedVariables
    };
    
    // Save to CDC
    _onUpdateCdc({ configuration: updatedConfig });
    
    // Update local state
    setVariableValues(prev => ({
      ...prev,
      [variableName]: value
    }));
  };

  const _getVariableCurrentValue = (variable) => {
    return variableValues[variable.name] || variable.default_value || "";
  };

  const _getVariableOriginalValue = (variable) => {
    // Check if there's an override in CDC configuration
    const overrideValue = cdc.configuration?.variables?.find(v => v.name === variable.name)?.value;
    return overrideValue !== undefined ? overrideValue : (variable.default_value || "");
  };

  const _hasVariableChanged = (variable) => {
    const currentValue = variableValues[variable.name] || "";
    const originalValue = _getVariableOriginalValue(variable);
    return currentValue !== originalValue;
  };

  const _onClearVariableOverride = (variableName) => {
    // Get current configuration
    const currentConfig = cdc.configuration || {};
    const currentVariables = currentConfig.variables || [];
    
    // Remove the variable override
    const updatedVariables = currentVariables.filter(v => v.name !== variableName);
    
    // Update the configuration
    const updatedConfig = {
      ...currentConfig,
      variables: updatedVariables
    };
    
    // Save to CDC
    _onUpdateCdc({ configuration: updatedConfig });
    
    // Reset local state to default value
    const variable = variables.find(v => v.name === variableName);
    setVariableValues(prev => ({
      ...prev,
      [variableName]: variable?.default_value || ""
    }));
  };

  return (
    <div>
      <Row align="center">
        <Input
          placeholder="Enter a name for your dataset"
          label="Dataset name"
          value={legend}
          onChange={(e) => setLegend(e.target.value)}
          variant="bordered"
        />
        {legend && legend !== cdc.legend && (
          <>
            <Spacer x={2} />
            <Button
              isIconOnly
              color="primary"
              isLoading={false}
              size="sm"
              onPress={_onSaveLegend}
            >
              <LuCheck />
            </Button>
          </>
        )}
      </Row>

      {canAccess("teamAdmin", user.id, team.TeamRoles) && (
        <>
          <Spacer y={2} />
          <div className="flex flex-row justify-between">
            <Button
              variant="ghost"
              size="sm"
              endContent={<LuSettings size={18} />}
              onPress={() => setEditConfirmation(true)}
            >
              Edit dataset
            </Button>

            <div className="flex flex-row gap-2 items-center">
              {dataRequests?.map((dr) => (
                <Tooltip content={dr?.Connection?.name} key={dr.id}>
                  <Avatar
                    key={dr.id}
                    src={connectionImages(isDark)[dr?.Connection?.subType]}
                    isBordered
                    size="sm"
                  />
                </Tooltip>
              ))}
              <div><LuPlug /></div>
            </div>
          </div>
        </>
      )}

      <Spacer y={4} />
      <Divider />
      <Spacer y={2} />
      
      <Row>
        <Text b>{"Dataset settings"}</Text>
      </Row>
      <Spacer y={1} />

      {chart.type !== "table" && (
        <>
          <Row align="center" justify={"space-between"}>
            <div className="text-sm">Sort records</div>
            <Row align="center">
              <Tooltip content="Sort the dataset in ascending order">
                <Button
                  color={cdc.sort === "asc" ? "secondary" : "default"}
                  variant={cdc.sort !== "asc" ? "bordered" : "solid"}
                  onPress={() => {
                    if (cdc.sort === "asc") {
                      _onUpdateCdc({ sort: "" });
                    } else {
                      _onUpdateCdc({ sort: "asc" });
                    }
                  }}
                  isIconOnly
                >
                  <LuArrowDown01 />
                </Button>
              </Tooltip>
              <Spacer x={1} />
              <Tooltip content="Sort the dataset in descending order">
                <Button
                  color={cdc.sort === "desc" ? "secondary" : "default"}
                  variant={cdc.sort !== "desc" ? "bordered" : "solid"}
                  onPress={() => {
                    if (cdc.sort === "desc") {
                      _onUpdateCdc({ sort: "" });
                    } else {
                      _onUpdateCdc({ sort: "desc" });
                    }
                  }}
                  isIconOnly
                >
                  <LuArrowDown10 />
                </Button>
              </Tooltip>
              {cdc.sort && (
                <>
                  <Spacer x={1} />
                  <Tooltip content="Clear sorting">
                    <Link className="text-danger" onPress={() => _onUpdateCdc({ sort: "" })}>
                      <LuCircleX className="text-danger" />
                    </Link>
                  </Tooltip>
                </>
              )}
            </Row>
          </Row>
          <Spacer y={2} />

          <Row align={"center"} justify={"space-between"}>
            <div className="text-sm">Max records</div>
            <Row align="center">
              <Input
                labelPlacement="outside"
                placeholder="Max records"
                value={maxRecords}
                onChange={(e) => setMaxRecords(e.target.value)}
                variant="bordered"
                type="number"
                min={1}
              />
              {maxRecords && (
                <>
                  <Spacer x={1} />
                    {maxRecords !== cdc.maxRecords && (
                      <>
                        <Tooltip content="Save">
                          <Link className="text-success" onPress={() => _onUpdateCdc({ maxRecords: maxRecords })}>
                            <LuCircleCheck className="text-success" />
                          </Link>
                        </Tooltip>
                        <Spacer x={1} />
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
            </Row>
          </Row>

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
          onUpdate={(data) => _onUpdateTableConfig(data)}
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
              <Row align={"center"} justify={"space-between"}>
                <div className="flex flex-col">
                  <Popover>
                    <PopoverTrigger>
                      <div className="flex flex-row gap-1 items-center">
                        <div className="text-sm">
                          {"Metric formula"}
                        </div>
                        <LuInfo size={18} />
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
                      onChange={(e) => setFormula(e.target.value)}
                      variant="bordered"
                      fullWidth
                    />
                    {formula !== cdc.formula && (
                      <Tooltip
                        content={"Apply the formula"}
                      >
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
              </Row>
            )}
          </div>

          <Spacer y={4} />
          <Divider />
          <Spacer y={4} />

          <div>
            {!goal && chart.type !== "table" && (
              <div>
                <Link onPress={() => setGoal(1000)} className="flex items-center cursor-pointer chart-cdc-goal">
                  <TbProgressCheck size={24} />
                  <Spacer x={1} />
                  <div className="text-sm text-foreground">Set a goal</div>
                </Link>
              </div>
            )}
            {goal && chart.type !== "table" && (
              <Row align={"center"} justify={"space-between"}>
                <Row align="center">
                  <div className="text-sm text-foreground">{"Goal"}</div>
                  <Spacer x={1} />
                  <Tooltip content="A goal can be displayed as a progress bar in your KPI charts. Enter a number without any other characters. (e.g. 1000 instead of 1k)">
                    <div><LuInfo size={18} /></div>
                  </Tooltip>
                </Row>
                <Row align="center" className={"gap-2"}>
                  <Input
                    placeholder="Enter your goal here"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    variant="bordered"
                    labelPlacement="outside"
                  />
                  {goal !== cdc.goal && (
                    <Tooltip
                      content={"Save goal"}
                    >
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
                </Row>
              </Row>
            )}
          </div>

          <Spacer y={4} />
          <Divider />
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
          
          <div>
            <LinkNext to={`/${params.teamId}/dataset/${cdc.dataset_id}?project_id=${params.projectId}&chart_id=${chartId}&editFilters=true`} className="flex items-center cursor-pointer chart-cdc-goal">
              <LuListFilter size={24} className="text-primary" />
              <Spacer x={1} />
              <div className="text-sm text-foreground">Edit filters</div>
            </LinkNext>
          </div>

          <Spacer y={4} />
          <Divider />
          <Spacer y={4} />

          <div className="flex flex-col gap-2">
            <div className="font-bold">{"Variables"}</div>
            {variables.map((variable) => (
              <div key={variable.id} className="flex flex-col gap-1">
                <Input
                  startContent={
                    <div className="flex flex-row gap-1 items-center">
                      <LuVariable size={18} />
                      <div className="text-sm text-gray-400">{variable.name}</div>
                    </div>
                  }
                  placeholder={`Default: ${variable.default_value || "No default"}`}
                  value={_getVariableCurrentValue(variable)}
                  onChange={(e) => {
                    setVariableValues(prev => ({
                      ...prev,
                      [variable.name]: e.target.value
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
                              setVariableValues(prev => ({
                                ...prev,
                                [variable.name]: originalValue
                              }));
                            }}
                            className="text-warning"
                          >
                            <LuCircleX className="text-warning" />
                          </Link>
                        </Tooltip>
                      </div>
                    ) : cdc.configuration?.variables?.find(v => v.name === variable.name) && (
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
        </>
      )}

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <div className="chart-cdc-colors">
        <Row>
          <Text b>{"Dataset colors"}</Text>
        </Row>
        <Spacer y={2} />

        <Row align={"center"} justify={"space-between"}>
          <Text>Primary color</Text>
          <div>
            <Popover>
              <PopoverTrigger>
                <Chip
                  style={_getDatasetColor(cdc.datasetColor)}
                  size="lg"
                  radius="sm"
                />
              </PopoverTrigger>
              <PopoverContent className="border-none bg-transparent shadow-none">
                <TwitterPicker
                  triangle={"hide"}
                  color={cdc.datasetColor}
                  colors={Object.values(chartColors).map((c) => c.hex)}
                  onChangeComplete={_onChangeDatasetColor}
                />
              </PopoverContent>
            </Popover>
          </div>
        </Row>
        <Spacer y={2} />

        <Row align={"center"} justify={"space-between"}>
          <Row align={"center"}>
            <Checkbox
              isSelected={cdc.fill}
              onChange={() => _onUpdateCdc({ fill: !cdc.fill, fillColor: ["transparent"] })}
              isDisabled={cdc.multiFill}
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
                  />
                </PopoverTrigger>
                <PopoverContent className="border-none bg-transparent shadow-none">
                  <SketchPicker
                    color={Array.isArray(cdc.fillColor) ? cdc.fillColor[0] : cdc.fillColor}
                    presetColors={Object.values(chartColors).map((c) => c.hex)}
                    onChangeComplete={(color) => _onChangeFillColor(color)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </Row>
        <Spacer y={2} />

        {chart.type !== "line" && (
          <Row>
            <Checkbox
              isSelected={cdc.multiFill}
              onChange={() => _onChangeMultiFill()}
            >
              Multiple colors
            </Checkbox>
          </Row>
        )}

        {chart.type !== "line" && cdc.multiFill && (
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
                          colors={Object.values(chartColors).map((c) => c.hex)}
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

      <Row>
        <Button
          variant="faded"
          color="danger"
          size="sm"
          onClick={_onRemoveCdc}
        >
          {`Remove ${cdc.legend}`}
        </Button>
      </Row>

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
              onClick={() => setEditConfirmation(false)}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onClick={() => {
                setEditConfirmation(false);
                navigate(`/${params.teamId}/dataset/${cdc.dataset_id}?project_id=${params.projectId}&chart_id=${chartId}`);
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
  cdcId: PropTypes.number.isRequired,
};

ChartDatasetConfig.defaultProps = {
  dataRequests: [],
};

export default ChartDatasetConfig
