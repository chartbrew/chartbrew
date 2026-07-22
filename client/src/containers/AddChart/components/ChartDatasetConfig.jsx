import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Avatar,
  Button,
  Checkbox,
  Chip,
  ColorSlider,
  Separator,
  Input,
  InputGroup,
  Link,
  Modal,
  Popover,
  ScrollShadow,
  SearchField,
  Spinner,
  Switch,
  Tabs,
  Tooltip,
  Label,
  TextField,
} from "@heroui/react";
import { commonColors } from "../../../lib/themeTokens";
import { TbMathFunctionY } from "react-icons/tb";
import { useNavigate, useParams } from "react-router";
import {
  LuArrowDown01, LuArrowDown10, LuCircleCheck, LuInfo,
  LuPlug,
  LuWandSparkles, LuCircleX,
  LuVariable,
  LuChevronDown,
  LuChevronUp,
  LuEye,
  LuEyeOff,
} from "react-icons/lu";

import Text from "../../../components/Text";
import Row from "../../../components/Row";
import {
  removeCdc,
  runQuery,
  selectCdc,
  updateCdc,
  updateChart,
} from "../../../slices/chart";
import DatasetAlerts from "./DatasetAlerts";
import { chartColors, getChartColorForKey, primary } from "../../../config/colors";
import { flatMap } from "lodash";
import TableConfiguration from "../../../components/TableConfiguration";
import FormulaTips from "../../../components/FormulaTips";
import canAccess from "../../../config/canAccess";
import { selectTeam } from "../../../slices/team";
import { selectUser } from "../../../slices/user";
import getConnectionLogo from "../../../modules/getConnectionLogo";
import { useTheme } from "../../../modules/ThemeContext";
import ChartDatasetDataSetup from "./ChartDatasetDataSetup";
import getDatasetDisplayName from "../../../modules/getDatasetDisplayName";
import ColorPickerControl from "../../../components/ColorPickerControl";
import { getRgbColorChannels } from "../../../modules/colorPicker";
import {
  updateBindingFill,
  updateLayerFormula,
  updateLayerSeriesOptions,
  updateSeriesColor,
} from "../../../modules/visualization";

function getFillSliderColor(color, opacity) {
  const { red, green, blue } = getRgbColorChannels(color, chartColors.blue.hex);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function FillOpacityControl(props) {
  const {
    color,
    controlId,
    fill,
    onFillChange,
    onOpacityChange,
    opacity,
  } = props;

  return (
    <div className="rounded-xl border border-divider bg-content2/30 p-3">
      <Switch
        id={controlId}
        isSelected={fill}
        onChange={onFillChange}
      >
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Fill background
        </Switch.Content>
      </Switch>

      {fill && (
        <ColorSlider
          aria-label="Fill opacity"
          channel="alpha"
          className="mt-3 gap-1"
          colorSpace="rgb"
          defaultValue={getFillSliderColor(color, opacity)}
          onChangeEnd={(nextColor) => {
            const nextOpacity = nextColor.toFormat("rgb").getChannelValue("alpha");
            onOpacityChange(Number(nextOpacity.toFixed(2)));
          }}
        >
          <div className="flex items-center justify-between text-xs font-medium text-muted">
            <Label>Opacity</Label>
            <ColorSlider.Output />
          </div>
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider>
      )}
    </div>
  );
}

FillOpacityControl.propTypes = {
  color: PropTypes.string.isRequired,
  controlId: PropTypes.string.isRequired,
  fill: PropTypes.bool.isRequired,
  onFillChange: PropTypes.func.isRequired,
  onOpacityChange: PropTypes.func.isRequired,
  opacity: PropTypes.number.isRequired,
};

function DatasetLabelField({ initialValue, onSave }) {
  const [value, setValue] = useState(initialValue);
  const nextValue = value.trim();
  const hasChanges = Boolean(nextValue) && nextValue !== initialValue;

  const _save = () => {
    if (hasChanges) onSave(nextValue);
  };

  return (
    <TextField className="w-full" name="dataset-label">
      <Label>Dataset label</Label>
      <InputGroup fullWidth variant="secondary">
        <InputGroup.Input
          placeholder="Enter a label for this dataset"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              _save();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setValue(initialValue);
            }
          }}
        />
        {hasChanges && (
          <InputGroup.Suffix className="pr-2 border-none">
            <Button size="sm" variant="secondary" onPress={_save}>
              Save
            </Button>
          </InputGroup.Suffix>
        )}
      </InputGroup>
    </TextField>
  );
}

DatasetLabelField.propTypes = {
  initialValue: PropTypes.string.isRequired,
  onSave: PropTypes.func.isRequired,
};

function ChartDatasetConfig(props) {
  const { chartId, cdcId, dataRequests, onRemove } = props;

  const [formula, setFormula] = useState("");
  const [maxRecords, setMaxRecords] = useState("");
  const [dataItems, setDataItems] = useState({});
  const [tableFields, setTableFields] = useState([]);
  const [editConfirmation, setEditConfirmation] = useState(false);
  const [variables, setVariables] = useState([]);
  const [variableValues, setVariableValues] = useState({});
  const [activeTab, setActiveTab] = useState("data-setup");
  const [seriesSearch, setSeriesSearch] = useState("");

  const cdc = useSelector((state) => selectCdc(state, chartId, cdcId));
  const dataset = useSelector((state) => (
    cdc?.dataset_id
      ? state.dataset.data.find((d) => d.id === parseInt(cdc.dataset_id, 10))
      : null
  ));
  const drs = dataset?.DataRequests || [];
  const chart = useSelector((state) => state.chart.data.find((c) => c.id === chartId));
  const bindingLayers = (chart?.visualization?.layers || []).filter((layer) => {
    return `${layer.bindingId}` === `${cdc?.id}`;
  });
  const bindingLayerIds = new Set(bindingLayers.map((layer) => layer.id));
  const runtimeSeries = (
    chart?.chartData?.meta?.availableSeries
    || chart?.chartData?.meta?.series
    || []
  ).filter((series) => {
    return bindingLayerIds.has(series.layerId);
  });
  const runtimeCategories = (chart?.chartData?.meta?.categories || []).filter((category) => {
    return bindingLayerIds.has(category.layerId);
  });
  const usesCategorySliceColors = ["pie", "doughnut", "polar"].includes(chart?.type)
    && runtimeCategories.length > 0;
  const colorItems = usesCategorySliceColors ? runtimeCategories : runtimeSeries;
  const usesGeneratedSeriesColors = usesCategorySliceColors || runtimeSeries.length > 0 && (
    runtimeSeries.length > 1
    || bindingLayers.some((layer) => Boolean(layer.encoding?.breakdown))
  );
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);

  const dispatch = useDispatch();
  const params = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  useEffect(() => {
    setFormula(cdc?.formula || "");
    setMaxRecords(cdc?.maxRecords || "");
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

  const _onUpdateVisualization = ({ cdcChanges, chartChanges, refresh, visualization }) => {
    const updates = [dispatch(updateChart({
      project_id: params.projectId,
      chart_id: chartId,
      data: {
        ...chartChanges,
        visualization,
      },
    }))];
    if (cdcChanges) {
      updates.push(dispatch(updateCdc({
        project_id: params.projectId,
        chart_id: chartId,
        cdc_id: cdc.id,
        data: cdcChanges,
      })));
    }
    Promise.all(updates).then(() => {
      if (refresh) _onRunQuery(false);
    });
  };

  const _getSeriesLayer = (series) => bindingLayers.find((layer) => {
    return layer.id === series.layerId;
  });

  const _getSeriesOverrideColor = (series) => {
    const layer = _getSeriesLayer(series);
    return layer?.style?.series?.[series.id]?.color
      || layer?.style?.series?.[series.key]?.color
      || null;
  };

  const _getSeriesColor = (series) => {
    return _getSeriesOverrideColor(series) || series.color || getChartColorForKey(series.id);
  };

  const _onChangeSeriesColor = (series, color) => {
    const visualization = updateSeriesColor(
      chart.visualization,
      series.layerId,
      series.id,
      color
    );
    _onUpdateVisualization({ refresh: true, visualization });
  };

  const _getLayerSeriesOptions = (series) => {
    return _getSeriesLayer(series)?.options?.series || {};
  };

  const _onToggleSeries = (series) => {
    const options = _getLayerSeriesOptions(series);
    const hidden = new Set(options.hidden || []);
    if (hidden.has(series.id)) hidden.delete(series.id);
    else hidden.add(series.id);
    const visualization = updateLayerSeriesOptions(
      chart.visualization,
      series.layerId,
      { hidden: [...hidden] }
    );
    _onUpdateVisualization({ refresh: true, visualization });
  };

  const _onMoveSeries = (series, offset) => {
    const layerSeries = runtimeSeries.filter((item) => item.layerId === series.layerId);
    const configuredOrder = _getLayerSeriesOptions(series).order || [];
    const order = [
      ...configuredOrder.filter((id) => layerSeries.some((item) => item.id === id)),
      ...layerSeries.map((item) => item.id).filter((id) => !configuredOrder.includes(id)),
    ];
    const currentIndex = order.indexOf(series.id);
    const nextIndex = currentIndex + offset;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= order.length) return;
    [order[currentIndex], order[nextIndex]] = [order[nextIndex], order[currentIndex]];
    const visualization = updateLayerSeriesOptions(
      chart.visualization,
      series.layerId,
      { order }
    );
    _onUpdateVisualization({ refresh: true, visualization });
  };

  const _onChangeFill = (fill, fillOpacity) => {
    const visualization = updateBindingFill(
      chart.visualization,
      cdc.id,
      { fill, fillOpacity }
    );
    _onUpdateVisualization({ refresh: true, visualization });
  };

  const _getDatasetColor = (datasetColor) => ({
    cursor: "pointer",
    backgroundColor: datasetColor === "rgba(0,0,0,0)" ? primary : datasetColor,
    border: `1px solid ${commonColors.zinc[500]}`,
  });

  const _onChangeDatasetColor = (color) => {
    _onUpdateCdc({ datasetColor: color });
  };

  const _onChangeFillColor = (color, fillIndex) => {
    if (!fillIndex && fillIndex !== 0) {
      _onUpdateCdc({ fillColor: [color] });
    } else {
      const newFillColor = [...cdc.fillColor];
      if (Array.isArray(newFillColor)) {
        newFillColor[fillIndex] = color;
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
    const layer = bindingLayers[0];
    if (!layer) return;
    _onUpdateVisualization({
      cdcChanges: { formula: "${val / 100}" },
      refresh: true,
      visualization: updateLayerFormula(chart.visualization, layer.id, "${val / 100}"),
    });
  };

  const _onRemoveFormula = () => {
    setFormula("");
    const layer = bindingLayers[0];
    if (!layer) return;
    _onUpdateVisualization({
      cdcChanges: { formula: "" },
      refresh: true,
      visualization: updateLayerFormula(chart.visualization, layer.id, null),
    });
  };

  const _onApplyFormula = () => {
    const layer = bindingLayers[0];
    if (!layer) return;
    _onUpdateVisualization({
      cdcChanges: { formula },
      refresh: true,
      visualization: updateLayerFormula(chart.visualization, layer.id, formula),
    });
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

  const seriesLabel = cdc.legend || getDatasetDisplayName(dataset) || "Untitled dataset";
  const fillLayer = bindingLayers[0];
  const fillEnabled = fillLayer?.style?.fill ?? cdc.fill ?? chart.type === "bar";
  const configuredFillOpacity = fillLayer?.style?.fillOpacity;
  const fillOpacity = Number.isFinite(configuredFillOpacity)
    ? Math.min(1, Math.max(0, configuredFillOpacity))
    : (chart.type === "bar" ? 0.65 : chart.type === "radar" ? 0.15 : 0.2);
  const fillBaseColor = runtimeSeries[0]
    ? _getSeriesColor(runtimeSeries[0])
    : cdc.datasetColor || chartColors.blue.hex;
  const visibleColorItems = colorItems.filter((item) => {
    return item.label.toLowerCase().includes(seriesSearch.trim().toLowerCase());
  });

  return (
    <div>
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key)}
        aria-label="Visualization configuration"
        fullWidth
      >
        <Tabs.ListContainer>
          <Tabs.List className="w-full">
            <Tabs.Tab id="data-setup">
              <Tabs.Indicator />
              Build
            </Tabs.Tab>
            <Tabs.Tab id="display">
              <Tabs.Indicator />
              Display
            </Tabs.Tab>
            <Tabs.Tab id="automation">
              <Tabs.Indicator />
              Automation
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="data-setup">
          <div className="h-2" />
          <DatasetLabelField
            key={cdc.id}
            initialValue={seriesLabel}
            onSave={(label) => _onUpdateCdc({ legend: label })}
          />
          <div className="h-4" />
          <ChartDatasetDataSetup
            cdc={cdc}
            dataset={dataset}
            chart={chart}
            teamId={team?.id}
            onUpdateCdc={_onUpdateCdc}
            onUpdateVisualization={_onUpdateVisualization}
            onEditDataset={_onEditDataset}
          />
        </Tabs.Panel>

        <Tabs.Panel id="display">
          <div className="h-2" />

          {chart.type !== "table" && (
            <>
              <div className="chart-cdc-colors">
                <div className="font-bold">
                  {usesCategorySliceColors ? "Slice colors" : "Series colors"}
                </div>

                {usesGeneratedSeriesColors ? (
                  <>
                    {colorItems.length > 6 && (
                      <SearchField
                        className="mt-2"
                        name={`series-search-${cdc.id}`}
                        value={seriesSearch}
                        variant="secondary"
                        onChange={setSeriesSearch}
                      >
                        <Label>Find a series</Label>
                        <SearchField.Group>
                          <SearchField.SearchIcon />
                          <SearchField.Input placeholder={usesCategorySliceColors ? "Search slices" : "Search generated series"} />
                          <SearchField.ClearButton />
                        </SearchField.Group>
                      </SearchField>
                    )}
                    <ScrollShadow className="mt-2 max-h-[240px]">
                      <div className="flex flex-col gap-1 py-1">
                        {visibleColorItems.map((series) => {
                          const seriesColor = _getSeriesColor(series);
                          const overrideColor = _getSeriesOverrideColor(series);
                          const seriesOptions = _getLayerSeriesOptions(series);
                          const isHidden = (seriesOptions.hidden || []).includes(series.id);
                          const layerSeries = runtimeSeries.filter((item) => item.layerId === series.layerId);
                          const seriesIndex = layerSeries.findIndex((item) => item.id === series.id);
                          return (
                            <div
                              key={series.id}
                              className="flex items-center gap-1 rounded-lg px-1 py-1 hover:bg-content2/50"
                            >
                              <div className={isHidden ? "min-w-0 flex-1 opacity-50" : "min-w-0 flex-1"}>
                                <ColorPickerControl
                                  ariaLabel={`Change ${series.label} series color`}
                                  clearLabel="Use automatic color"
                                  fallbackColor={getChartColorForKey(series.id)}
                                  onChange={(color) => _onChangeSeriesColor(series, color)}
                                  onClear={() => _onChangeSeriesColor(series, null)}
                                  presetColors={Object.values(chartColors).map((color) => color.hex)}
                                  renderTrigger={({ color }) => (
                                    <Chip size="lg" variant="secondary" className="max-w-full cursor-pointer">
                                      <span
                                        aria-hidden
                                        className="size-3 shrink-0 rounded-full"
                                        style={{ backgroundColor: color }}
                                      />
                                      <Chip.Label className="truncate">{series.label}</Chip.Label>
                                    </Chip>
                                  )}
                                  showClearButton={Boolean(overrideColor)}
                                  value={seriesColor}
                                  valueFormat="hex"
                                />
                              </div>
                              {!usesCategorySliceColors && (
                                <>
                                  <Button
                                    aria-label={`${isHidden ? "Show" : "Hide"} ${series.label}`}
                                    isIconOnly
                                    size="sm"
                                    variant="tertiary"
                                    onPress={() => _onToggleSeries(series)}
                                  >
                                    {isHidden ? <LuEyeOff /> : <LuEye />}
                                  </Button>
                                  <Button
                                    aria-label={`Move ${series.label} up`}
                                    isDisabled={seriesIndex === 0}
                                    isIconOnly
                                    size="sm"
                                    variant="tertiary"
                                    onPress={() => _onMoveSeries(series, -1)}
                                  >
                                    <LuChevronUp />
                                  </Button>
                                  <Button
                                    aria-label={`Move ${series.label} down`}
                                    isDisabled={seriesIndex === layerSeries.length - 1}
                                    isIconOnly
                                    size="sm"
                                    variant="tertiary"
                                    onPress={() => _onMoveSeries(series, 1)}
                                  >
                                    <LuChevronDown />
                                  </Button>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollShadow>
                  </>
                ) : (
                  <>
                    <div className="flex flex-row justify-between items-center">
                      <div className="text-sm">Primary color</div>
                      <div>
                        <ColorPickerControl
                          ariaLabel="Primary series color"
                          fallbackColor={chartColors.blue.hex}
                          onChange={_onChangeDatasetColor}
                          presetColors={Object.values(chartColors).map((color) => color.hex)}
                          renderTrigger={() => (
                            <div
                              style={_getDatasetColor(cdc.datasetColor)}
                              className="w-full h-8 rounded-3xl pl-[100px]"
                            />
                          )}
                          value={cdc.datasetColor}
                          valueFormat="hex"
                        />
                      </div>
                    </div>
                    <div className="h-2" />

                    {!["line", "bar", "matrix", "radar"].includes(chart.type) && (
                      <Row align={"center"} justify={"space-between"}>
                        <Row align={"center"}>
                          <Checkbox
                            id={`cdc-fill-${cdc.id}`}
                            isSelected={bindingLayers[0]?.style?.fill ?? cdc.fill}
                            onChange={(selected) => _onUpdateCdc({ fill: selected, fillColor: ["transparent"] })}
                            isDisabled={cdc.multiFill}
                            variant="secondary"
                          >
                            <Checkbox.Content>
                              <Checkbox.Control className="size-4 shrink-0">
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                              Fill Color
                            </Checkbox.Content>
                          </Checkbox>
                        </Row>
                        {cdc.fill && !cdc.multiFill && (
                          <div>
                            <ColorPickerControl
                              ariaLabel="Fill color"
                              fallbackColor={chartColors.blue.hex}
                              onChange={(color) => _onChangeFillColor(color)}
                              presetColors={Object.values(chartColors).map((color) => color.hex)}
                              renderTrigger={() => (
                                <div
                                  style={_getDatasetColor(Array.isArray(cdc.fillColor) ? cdc.fillColor[0] : cdc.fillColor)}
                                  className="w-full h-8 rounded-3xl pl-[100px]"
                                />
                              )}
                              value={Array.isArray(cdc.fillColor) ? cdc.fillColor[0] : cdc.fillColor}
                            />
                          </div>
                        )}
                      </Row>
                    )}
                    <div className="h-2" />

                    {!["line", "bar", "matrix", "radar"].includes(chart.type) && (
                      <Row>
                        <Checkbox
                          id={`cdc-multifill-${cdc.id}`}
                          isSelected={cdc.multiFill}
                          onChange={(selected) => {
                            if (selected !== cdc.multiFill) _onChangeMultiFill();
                          }}
                          variant="secondary"
                        >
                          <Checkbox.Content>
                            <Checkbox.Control className="size-4 shrink-0">
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                            Multiple colors
                          </Checkbox.Content>
                        </Checkbox>
                      </Row>
                    )}

                    {!["line", "bar", "matrix", "radar"].includes(chart.type) && cdc.multiFill && (
                      <>
                        <div className="h-4" />
                        <ScrollShadow className="max-h-[300px] border-2 border-solid border-content3 rounded-md p-2">
                          {dataItems?.labels?.map((label, index) => (
                            <Row key={label} justify={"space-between"}>
                              <Text size="sm">{label}</Text>
                              <div>
                                <ColorPickerControl
                                  ariaLabel={`${label} fill color`}
                                  fallbackColor={chartColors.blue.hex}
                                  onChange={(color) => _onChangeFillColor(color, index)}
                                  presetColors={Object.values(chartColors).map((color) => color.hex)}
                                  renderTrigger={() => (
                                    <div
                                      style={_getDatasetColor(cdc.fillColor[index] || "white")}
                                      className="w-full h-8 rounded-3xl"
                                    />
                                  )}
                                  value={cdc.fillColor[index]}
                                />
                              </div>
                            </Row>
                          ))}
                        </ScrollShadow>
                        <div className="h-4" />
                      </>
                    )}
                  </>
                )}

                {["line", "bar", "radar"].includes(chart.type) && (
                  <>
                    <div className="h-4" />
                    <FillOpacityControl
                      key={`${cdc.id}-${fillBaseColor}-${fillOpacity}`}
                      color={fillBaseColor}
                      controlId={`cdc-fill-background-${cdc.id}`}
                      fill={Boolean(fillEnabled)}
                      opacity={fillOpacity}
                      onFillChange={(selected) => _onChangeFill(selected, fillOpacity)}
                      onOpacityChange={(opacity) => _onChangeFill(fillEnabled, opacity)}
                    />
                  </>
                )}
              </div>

              <div className="h-4" />
              <Separator />
              <div className="h-4" />
            </>
          )}

          {chart.type !== "table" && chart.type !== "matrix" && (
            <>
              <Row>
                <Text b>{"Series settings"}</Text>
              </Row>
              <div className="h-2" />
              <div className="flex flex-col gap-2">
                <div className="text-sm">Sort records</div>
                <div className="flex flex-row items-center gap-2">
                  <Tooltip>
                    <Tooltip.Trigger>
                      <Button
                        variant={cdc.sort === "asc" ? "secondary" : "tertiary"}
                        onPress={() => _onUpdateCdc({ sort: cdc.sort === "asc" ? "" : "asc" })}
                        fullWidth
                        size="sm"
                      >
                        <LuArrowDown01 />
                        Asc
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content>Sort the dataset in ascending order</Tooltip.Content>
                  </Tooltip>
                  <Tooltip>
                    <Tooltip.Trigger>
                      <Button
                        variant={cdc.sort === "desc" ? "secondary" : "tertiary"}
                        onPress={() => _onUpdateCdc({ sort: cdc.sort === "desc" ? "" : "desc" })}
                        fullWidth
                        size="sm"
                      >
                        <LuArrowDown10 />
                        Desc
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content>Sort the dataset in descending order</Tooltip.Content>
                  </Tooltip>
                  {cdc.sort && (
                    <div>
                      <Tooltip delay={0}>
                        <Tooltip.Trigger className="flex justify-center">
                          <Link className="text-danger" onPress={() => _onUpdateCdc({ sort: "" })}>
                            <LuCircleX className="text-danger" />
                          </Link>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Clear sorting</Tooltip.Content>
                      </Tooltip>
                    </div>
                  )}
                </div>
              </div>
              <div className="h-4" />

              <div className="flex flex-col gap-2">
                <div className="flex flex-row items-center gap-2">
                  <TextField className="w-full" name="max-records">
                    <Label>Max records</Label>
                    <InputGroup variant="secondary" fullWidth>
                      <InputGroup.Input
                        placeholder="Max records"
                        value={maxRecords}
                        onChange={(event) => setMaxRecords(event.target.value)}
                        variant="secondary"
                        labelPlacement="outside"
                        description="Limit the number of records shown"
                      />
                      <InputGroup.Suffix className="pr-2 border-none">
                        {maxRecords && (
                          <div className="flex flex-row gap-1">
                            {`${maxRecords}` !== `${cdc.maxRecords || ""}` && (
                              <>
                                <Tooltip>
                                  <Tooltip.Trigger className="flex justify-center">
                                    <Link className="text-success" onPress={() => _onUpdateCdc({ maxRecords })}>
                                      <LuCircleCheck className="text-success" />
                                    </Link>
                                  </Tooltip.Trigger>
                                  <Tooltip.Content>Save</Tooltip.Content>
                                </Tooltip>
                              </>
                            )}
                            <Tooltip>
                              <Tooltip.Trigger className="flex justify-center">
                                <Link
                                  className="text-danger"
                                  onPress={() => {
                                    _onUpdateCdc({ maxRecords: null });
                                    setMaxRecords("");
                                  }}
                                >
                                  <LuCircleX className="text-danger" />
                                </Link>
                              </Tooltip.Trigger>
                              <Tooltip.Content>Clear limit</Tooltip.Content>
                            </Tooltip>
                          </div>
                        )}
                      </InputGroup.Suffix>
                    </InputGroup>
                  </TextField>
                </div>
              </div>

              <div className="h-4" />
              <Separator />
              <div className="h-4" />
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
                    <div className="w-2" />
                    <div className="text-sm text-foreground">Apply formula on metrics</div>
                  </Link>
                )}
                {formula && (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col">
                      <Popover>
                        <Popover.Trigger>
                          <div className="flex flex-row gap-1 items-center cursor-pointer">
                            <div className="text-sm">{"Metric formula"}</div>
                            <LuInfo size={16} />
                          </div>
                        </Popover.Trigger>
                        <Popover.Content>
                          <Popover.Dialog>
                            <FormulaTips />
                          </Popover.Dialog>
                        </Popover.Content>
                      </Popover>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex flex-row gap-3 items-center w-full">
                        <Input
                          labelPlacement="outside"
                          placeholder="Enter your formula here: {val}"
                          value={formula}
                          onChange={(event) => setFormula(event.target.value)}
                          variant="secondary"
                          fullWidth
                        />
                        {formula !== cdc.formula && (
                          <Tooltip>
                            <Tooltip.Trigger className="flex justify-center">
                              <Link onPress={_onApplyFormula}>
                                <LuCircleCheck className={"text-success"} />
                              </Link>
                            </Tooltip.Trigger>
                            <Tooltip.Content>Apply the formula</Tooltip.Content>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <Tooltip.Trigger className="flex justify-center">
                            <Link onPress={_onRemoveFormula}>
                              <LuCircleX className="text-danger" />
                            </Link>
                          </Tooltip.Trigger>
                          <Tooltip.Content>Remove formula</Tooltip.Content>
                        </Tooltip>
                        <Tooltip>
                          <Tooltip.Trigger className="flex justify-center">
                            <Link onPress={_onExampleFormula}>
                              <LuWandSparkles className="text-accent" />
                            </Link>
                          </Tooltip.Trigger>
                          <Tooltip.Content>Click for an example</Tooltip.Content>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </>
          )}
        </Tabs.Panel>

        <Tabs.Panel id="automation">
          <div className="h-2" />

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

          <div className="h-4" />
          <Separator />
          <div className="h-4" />

          <div className="flex flex-col gap-2">
            <div className="font-bold">{"Variables"}</div>
            {variables.map((variable) => (
              <div key={variable.id} className="flex flex-col gap-1">
                <TextField className="w-full" name={`chart-var-${variable.name}`}>
                  <InputGroup variant="secondary" fullWidth>
                    <InputGroup.Prefix>
                      <div className="flex flex-row items-center gap-1">
                        <LuVariable size={18} aria-hidden />
                        <span className="text-sm text-gray-400">{variable.name}</span>
                      </div>
                    </InputGroup.Prefix>
                    <InputGroup.Input
                      placeholder={`Default: ${variable.default_value || "No default"}`}
                      value={_getVariableCurrentValue(variable)}
                      onChange={(event) => {
                        setVariableValues((prev) => ({
                          ...prev,
                          [variable.name]: event.target.value,
                        }));
                      }}
                    />
                    <InputGroup.Suffix className="pr-1">
                      {_hasVariableChanged(variable) ? (
                        <div className="flex flex-row gap-1">
                          <Tooltip>
                            <Tooltip.Trigger>
                              <Link
                                onClick={() => _onSaveVariableValue(variable.name, variableValues[variable.name] || "")}
                                className="text-success"
                              >
                                <LuCircleCheck className="text-success" />
                              </Link>
                            </Tooltip.Trigger>
                            <Tooltip.Content>Save variable value</Tooltip.Content>
                          </Tooltip>
                          <Tooltip>
                            <Tooltip.Trigger>
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
                            </Tooltip.Trigger>
                            <Tooltip.Content>Reset to saved value</Tooltip.Content>
                          </Tooltip>
                        </div>
                      ) : cdc.configuration?.variables?.find((item) => item.name === variable.name) ? (
                        <div className="flex flex-row gap-1">
                          <Tooltip>
                            <Tooltip.Trigger>
                              <Link onPress={() => _onClearVariableOverride(variable.name)}>
                                <LuCircleX className="text-warning" />
                              </Link>
                            </Tooltip.Trigger>
                            <Tooltip.Content>Remove override and use default value</Tooltip.Content>
                          </Tooltip>
                        </div>
                      ) : null}
                    </InputGroup.Suffix>
                  </InputGroup>
                </TextField>
              </div>
            ))}
            {variables.length === 0 && (
              <div className="text-sm text-gray-400 italic">
                {"No variables found in the connected datasets."}
              </div>
            )}
          </div>
        </Tabs.Panel>
      </Tabs>

      <div className="h-4" />
      <Separator />
      <div className="h-4" />

      <div className="flex flex-row justify-between">
        {canAccess("teamAdmin", user.id, team?.TeamRoles) && (
          <div className="flex flex-row gap-2 items-center">
            {dataRequests?.map((dr) => (
              <Tooltip key={dr.id}>
                <Tooltip.Trigger>
                  <Avatar size="sm" className="ring-2 ring-primary shrink-0">
                    <Avatar.Image
                      src={getConnectionLogo(dr?.Connection, isDark)}
                      alt=""
                    />
                    <Avatar.Fallback />
                  </Avatar>
                </Tooltip.Trigger>
                <Tooltip.Content>{dr?.Connection?.name}</Tooltip.Content>
              </Tooltip>
            ))}
            {dataRequests?.length > 0 && <div><LuPlug /></div>}
          </div>
        )}

        <Button
          variant="danger-soft"
          size="sm"
          onPress={_onRemoveCdc}
        >
          {`Remove dataset: ${seriesLabel}`}
        </Button>
      </div>

      <Modal>
        <Modal.Backdrop isOpen={editConfirmation} onOpenChange={setEditConfirmation}>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Edit dataset?</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Text>
                  {"You are about to edit the dataset. This will affect all charts that use this dataset. Are you sure you want to continue?"}
                </Text>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="secondary"
                  slot="close"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onPress={() => {
                    setEditConfirmation(false);
                    navigate(`/datasets/${cdc.dataset_id}?project_id=${params.projectId}&chart_id=${chartId}`);
                  }}
                >
                  Continue
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
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
