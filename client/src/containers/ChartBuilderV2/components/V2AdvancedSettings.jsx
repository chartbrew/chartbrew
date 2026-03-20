import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch } from "react-redux";
import {
  Button,
  Checkbox,
  Chip,
  Divider,
  Input,
  Link,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Spacer,
  Tooltip,
  commonColors,
} from "@heroui/react";
import { TwitterPicker, SketchPicker } from "react-color";
import { TbMathFunctionY, TbProgressCheck } from "react-icons/tb";
import {
  LuCircleCheck,
  LuCircleX,
  LuInfo,
  LuVariable,
} from "react-icons/lu";

import { runQuery, updateCdc } from "../../../slices/chart";
import { chartColors, primary } from "../../../config/colors";
import FormulaTips from "../../../components/FormulaTips";
import DatasetAlerts from "../../AddChart/components/DatasetAlerts";

function V2AdvancedSettings({ chart, cdc, dataset }) {
  const [formula, setFormula] = useState("");
  const [goal, setGoal] = useState("");
  const [variables, setVariables] = useState([]);
  const [variableValues, setVariableValues] = useState({});

  const dispatch = useDispatch();

  useEffect(() => {
    setFormula(cdc?.formula || "");
    setGoal(cdc?.goal || "");
  }, [cdc?.formula, cdc?.goal]);

  useEffect(() => {
    const variableByName = {};

    (dataset?.DataRequests || []).forEach((request) => {
      (request?.VariableBindings || []).forEach((binding) => {
        if (binding?.name && !variableByName[binding.name]) {
          variableByName[binding.name] = binding;
        }
      });
    });

    const nextVariables = Object.values(variableByName);
    const configuredVariables = cdc?.configuration?.variables || [];
    const configuredByName = configuredVariables.reduce((acc, item) => {
      if (item?.name) {
        acc[item.name] = item.value;
      }

      return acc;
    }, {});

    const nextValues = {};
    nextVariables.forEach((variable) => {
      nextValues[variable.name] = configuredByName[variable.name] ?? variable.default_value ?? "";
    });

    setVariables(nextVariables);
    setVariableValues(nextValues);
  }, [cdc?.configuration?.variables, dataset?.DataRequests]);

  const multiFillLabels = useMemo(() => {
    if (chart?.type === "table" || chart?.type === "matrix") {
      return [];
    }

    return chart?.chartData?.data?.labels || [];
  }, [chart?.chartData?.data?.labels, chart?.type]);

  const _refreshChart = async ({ noSource = true, skipParsing = true } = {}) => {
    if (!chart?.id || !chart?.project_id) {
      return;
    }

    await dispatch(runQuery({
      project_id: chart.project_id,
      chart_id: chart.id,
      cdc_id: cdc.id,
      noSource,
      skipParsing: chart?.type === "matrix" ? false : skipParsing,
      getCache: true,
    })).unwrap();
  };

  const _updateCdc = async (data, refreshOptions = {}) => {
    await dispatch(updateCdc({
      project_id: chart.project_id,
      chart_id: chart.id,
      cdc_id: cdc.id,
      data,
    })).unwrap();

    await _refreshChart(refreshOptions);
  };

  const _getDatasetColorStyle = (datasetColor) => ({
    cursor: "pointer",
    backgroundColor: datasetColor === "rgba(0,0,0,0)" ? primary : datasetColor,
    border: `1px solid ${commonColors.zinc[500]}`,
  });

  const _onChangeDatasetColor = (color) => {
    _updateCdc({ datasetColor: color.hex });
  };

  const _onChangeFillColor = (color, fillIndex) => {
    const rgba = `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`;

    if (fillIndex === null || fillIndex === undefined) {
      _updateCdc({ fillColor: [rgba] });
      return;
    }

    const nextFillColor = Array.isArray(cdc?.fillColor) ? [...cdc.fillColor] : [];
    nextFillColor[fillIndex] = rgba;
    _updateCdc({ fillColor: nextFillColor });
  };

  const _onChangeMultiFill = () => {
    if (!cdc?.multiFill) {
      let nextFillColor = cdc?.fillColor;

      if (!Array.isArray(nextFillColor) || nextFillColor.length === 0) {
        nextFillColor = [nextFillColor];
      } else {
        nextFillColor = [...nextFillColor];
      }

      nextFillColor = nextFillColor.map((color, index) => {
        if (!color) {
          return Object.values(chartColors)[index % Object.values(chartColors).length].hex;
        }

        return color;
      });

      if (multiFillLabels.length > nextFillColor.length) {
        for (let i = nextFillColor.length; i < multiFillLabels.length; i += 1) {
          nextFillColor.push(Object.values(chartColors)[i % Object.values(chartColors).length].hex);
        }
      }

      _updateCdc({ multiFill: true, fillColor: nextFillColor });
      return;
    }

    const firstValidColor = Array.isArray(cdc?.fillColor)
      ? (cdc.fillColor.find((color) => color) || Object.values(chartColors)[0].hex)
      : (cdc?.fillColor || Object.values(chartColors)[0].hex);

    _updateCdc({ multiFill: false, fillColor: firstValidColor });
  };

  const _onAddFormula = () => {
    setFormula("{val}");
  };

  const _onApplyFormula = () => {
    _updateCdc({ formula }, { noSource: true, skipParsing: false });
  };

  const _onRemoveFormula = () => {
    setFormula("");
    _updateCdc({ formula: "" }, { noSource: true, skipParsing: false });
  };

  const _onExampleFormula = () => {
    setFormula("${val / 100}");
    _updateCdc({ formula: "${val / 100}" }, { noSource: true, skipParsing: false });
  };

  const _onSaveGoal = () => {
    _updateCdc({ goal }, { noSource: true, skipParsing: false });
  };

  const _onClearGoal = () => {
    setGoal("");
    _updateCdc({ goal: null }, { noSource: true, skipParsing: false });
  };

  const _onSaveVariableValue = (variableName) => {
    const currentConfig = cdc?.configuration || {};
    const currentVariables = Array.isArray(currentConfig.variables) ? [...currentConfig.variables] : [];
    const existingIndex = currentVariables.findIndex((item) => item.name === variableName);
    const value = variableValues[variableName] ?? "";

    if (existingIndex > -1) {
      currentVariables[existingIndex] = { name: variableName, value };
    } else {
      currentVariables.push({ name: variableName, value });
    }

    _updateCdc({
      configuration: {
        ...currentConfig,
        variables: currentVariables,
      },
    }, {
      noSource: false,
      skipParsing: false,
    });
  };

  const _onClearVariableOverride = (variableName) => {
    const currentConfig = cdc?.configuration || {};
    const nextVariables = Array.isArray(currentConfig.variables)
      ? currentConfig.variables.filter((item) => item.name !== variableName)
      : [];
    const variable = variables.find((item) => item.name === variableName);

    setVariableValues((prev) => ({
      ...prev,
      [variableName]: variable?.default_value ?? "",
    }));

    _updateCdc({
      configuration: {
        ...currentConfig,
        variables: nextVariables,
      },
    }, {
      noSource: false,
      skipParsing: false,
    });
  };

  const _getVariableOriginalValue = (variable) => {
    const overrideValue = cdc?.configuration?.variables?.find((item) => item.name === variable.name)?.value;
    return overrideValue !== undefined ? overrideValue : (variable.default_value || "");
  };

  const _hasVariableChanged = (variable) => {
    return (variableValues[variable.name] ?? "") !== _getVariableOriginalValue(variable);
  };

  return (
    <div className="rounded-lg border-1 border-divider bg-content1 p-4">
      <div>
        <div className="text-lg font-semibold">Advanced settings</div>
        <div className="text-sm text-default-500">
          Reuse the existing chart configuration model for styling, formulas, goals, alerts, and variable overrides.
        </div>
      </div>

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      {chart?.type !== "table" && (
        <>
          <div>
            <div className="text-sm font-semibold">Dataset colors</div>
            <Spacer y={2} />

            <div className="flex flex-row items-center justify-between gap-2">
              <div className="text-sm">Primary color</div>
              <Popover>
                <PopoverTrigger>
                  <Chip
                    style={_getDatasetColorStyle(cdc?.datasetColor)}
                    size="lg"
                    radius="sm"
                    className="pl-[100px]"
                  />
                </PopoverTrigger>
                <PopoverContent className="border-none bg-transparent shadow-none">
                  <TwitterPicker
                    triangle="hide"
                    color={cdc?.datasetColor}
                    colors={Object.values(chartColors).map((item) => item.hex)}
                    onChangeComplete={_onChangeDatasetColor}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Spacer y={3} />

            {chart?.type !== "matrix" && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-row items-center justify-between gap-2">
                  <Checkbox
                    isSelected={cdc?.fill}
                    onValueChange={(selected) => _updateCdc({
                      fill: selected,
                      fillColor: selected ? (cdc?.fillColor || ["transparent"]) : ["transparent"],
                    })}
                    isDisabled={cdc?.multiFill}
                    size="sm"
                  >
                    Fill color
                  </Checkbox>
                  {cdc?.fill && !cdc?.multiFill && (
                    <Popover>
                      <PopoverTrigger>
                        <Chip
                          style={_getDatasetColorStyle(Array.isArray(cdc?.fillColor) ? cdc.fillColor[0] : cdc?.fillColor)}
                          size="lg"
                          radius="sm"
                          className="pl-[100px]"
                        />
                      </PopoverTrigger>
                      <PopoverContent className="border-none bg-transparent shadow-none">
                        <SketchPicker
                          color={Array.isArray(cdc?.fillColor) ? cdc.fillColor[0] : cdc?.fillColor}
                          presetColors={Object.values(chartColors).map((item) => item.hex)}
                          onChangeComplete={(color) => _onChangeFillColor(color)}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {chart?.type !== "line" && (
                  <Checkbox
                    isSelected={cdc?.multiFill}
                    onValueChange={() => _onChangeMultiFill()}
                    size="sm"
                  >
                    Multiple colors
                  </Checkbox>
                )}

                {chart?.type !== "line" && cdc?.multiFill && multiFillLabels.length > 0 && (
                  <div className="max-h-[260px] rounded-lg border-1 border-divider p-3 overflow-auto">
                    <div className="flex flex-col gap-2">
                      {multiFillLabels.map((label, index) => (
                        <div key={`${label}-${index}`} className="flex flex-row items-center justify-between gap-3">
                          <div className="text-sm text-default-600 truncate">{label}</div>
                          <Popover>
                            <PopoverTrigger>
                              <Chip
                                style={_getDatasetColorStyle(cdc?.fillColor?.[index] || "white")}
                                radius="sm"
                              />
                            </PopoverTrigger>
                            <PopoverContent className="border-none bg-transparent shadow-none">
                              <TwitterPicker
                                triangle="hide"
                                color={cdc?.fillColor?.[index] || "white"}
                                colors={Object.values(chartColors).map((item) => item.hex)}
                                onChangeComplete={(color) => _onChangeFillColor(color, index)}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <Spacer y={4} />
          <Divider />
          <Spacer y={4} />
        </>
      )}

      {chart?.type !== "table" && (
        <>
          <div>
            {!formula ? (
              <Link onPress={_onAddFormula} className="flex items-center cursor-pointer">
                <TbMathFunctionY size={24} />
                <Spacer x={1} />
                <div className="text-sm text-foreground">Apply formula on metrics</div>
              </Link>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-row items-center gap-2">
                  <div className="text-sm font-semibold">Metric formula</div>
                  <Popover>
                    <PopoverTrigger>
                      <button type="button" className="text-default-500">
                        <LuInfo size={16} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent>
                      <FormulaTips />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex flex-row items-center gap-2">
                  <Input
                    placeholder="Enter your formula here: {val}"
                    value={formula}
                    onChange={(event) => setFormula(event.target.value)}
                    variant="bordered"
                  />
                  {formula !== (cdc?.formula || "") && (
                    <Tooltip content="Apply formula">
                      <Link onPress={_onApplyFormula}>
                        <LuCircleCheck className="text-success" />
                      </Link>
                    </Tooltip>
                  )}
                  <Tooltip content="Remove formula">
                    <Link onPress={_onRemoveFormula}>
                      <LuCircleX className="text-danger" />
                    </Link>
                  </Tooltip>
                  <Tooltip content="Use an example">
                    <Link onPress={_onExampleFormula}>
                      <TbMathFunctionY className="text-primary" />
                    </Link>
                  </Tooltip>
                </div>
              </div>
            )}
          </div>

          <Spacer y={4} />
          <Divider />
          <Spacer y={4} />

          <div>
            {!goal ? (
              <Link onPress={() => setGoal("1000")} className="flex items-center cursor-pointer">
                <TbProgressCheck size={24} />
                <Spacer x={1} />
                <div className="text-sm text-foreground">Set a goal</div>
              </Link>
            ) : (
              <div className="flex flex-row items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-row items-center gap-2">
                  <div className="text-sm font-semibold">Goal</div>
                  <Tooltip content="A goal can be displayed as a progress bar in KPI charts. Use a plain number.">
                    <div className="text-default-500">
                      <LuInfo size={16} />
                    </div>
                  </Tooltip>
                </div>

                <div className="flex flex-row items-center gap-2">
                  <Input
                    placeholder="Enter your goal here"
                    value={`${goal}`}
                    onChange={(event) => setGoal(event.target.value)}
                    variant="bordered"
                  />
                  {`${goal}` !== `${cdc?.goal || ""}` && (
                    <Tooltip content="Save goal">
                      <Link onPress={_onSaveGoal}>
                        <LuCircleCheck className="text-success" />
                      </Link>
                    </Tooltip>
                  )}
                  <Tooltip content="Remove goal">
                    <Link onPress={_onClearGoal}>
                      <LuCircleX className="text-danger" />
                    </Link>
                  </Tooltip>
                </div>
              </div>
            )}
          </div>

          <Spacer y={4} />
          <Divider />
          <Spacer y={4} />
        </>
      )}

      <div>
        <div className="flex flex-row items-center gap-2">
          <LuVariable size={18} />
          <div className="text-sm font-semibold">Variable values</div>
        </div>
        <div className="mt-1 text-sm text-default-500">
          Override dataset request variables for this chart only.
        </div>

        <Spacer y={3} />

        {variables.length === 0 && (
          <div className="rounded-lg border-1 border-dashed border-divider px-4 py-6 text-sm text-default-500">
            This dataset does not define request variables.
          </div>
        )}

        {variables.length > 0 && (
          <div className="flex flex-col gap-3">
            {variables.map((variable) => (
              <div key={variable.name} className="rounded-lg border-1 border-divider p-3">
                <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium">{variable.name}</div>
                    <div className="text-xs text-default-500">
                      {variable.type || "text"}
                      {variable.default_value ? ` • Default: ${variable.default_value}` : ""}
                    </div>
                  </div>
                  {variable.required && (
                    <Chip size="sm" color="warning" variant="flat">
                      Required
                    </Chip>
                  )}
                </div>

                <Spacer y={2} />

                <div className="flex flex-row items-center gap-2">
                  <Input
                    type={variable.type === "date" ? "date" : "text"}
                    value={variableValues[variable.name] ?? ""}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setVariableValues((prev) => ({
                        ...prev,
                        [variable.name]: nextValue,
                      }));
                    }}
                    variant="bordered"
                  />

                  {_hasVariableChanged(variable) && (
                    <Tooltip content="Save variable override">
                      <Link onPress={() => _onSaveVariableValue(variable.name)}>
                        <LuCircleCheck className="text-success" />
                      </Link>
                    </Tooltip>
                  )}

                  {cdc?.configuration?.variables?.find((item) => item.name === variable.name) && (
                    <Tooltip content="Clear override">
                      <Link onPress={() => _onClearVariableOverride(variable.name)}>
                        <LuCircleX className="text-danger" />
                      </Link>
                    </Tooltip>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <div>
        <div className="text-sm font-semibold">Alerts</div>
        <div className="mt-1 text-sm text-default-500">
          Alerts continue to use the existing chart dataset configuration and runtime payloads.
        </div>

        <Spacer y={3} />

        <DatasetAlerts
          chartId={chart.id}
          cdcId={cdc.id}
          projectId={chart.project_id}
        />
      </div>
    </div>
  );
}

V2AdvancedSettings.propTypes = {
  chart: PropTypes.object.isRequired,
  cdc: PropTypes.object.isRequired,
  dataset: PropTypes.object,
};

V2AdvancedSettings.defaultProps = {
  dataset: null,
};

export default V2AdvancedSettings;
