import React, {
  useState, useEffect, useCallback, useRef
} from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Calendar } from "react-date-range";
import { v4 as uuid} from "uuid";
import _ from "lodash";
import { formatISO, format } from "date-fns";
import { enGB } from "date-fns/locale";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import update from "immutability-helper";
import {
  Button, Accordion, Dropdown, Input, Link, Popover, Spacer, Tooltip, Divider,
  Chip, Switch, Modal, Checkbox, DropdownMenu, DropdownTrigger, DropdownItem,
  PopoverTrigger, PopoverContent, AccordionItem, ModalHeader, ModalBody, ModalFooter,
  ModalContent, Select, Listbox, ListboxItem, SelectItem, ScrollShadow,
} from "@heroui/react";
import { TbDragDrop, TbMathFunctionY, TbProgressCheck } from "react-icons/tb";
import {
  LuTriangleAlert, LuArrowDown01, LuArrowDown10, LuCalendarDays, LuCircleCheck,
  LuChevronDown, LuCircleChevronDown, LuChevronRight, LuEye, LuEyeOff, LuFilter,
  LuInfo, LuPlus, LuRedo, LuSearch, LuSettings, LuWandSparkles, LuCircleX,
} from "react-icons/lu";

import { runRequest as runRequestAction } from "../../../actions/dataset";
import fieldFinder from "../../../modules/fieldFinder";
import {
  blackTransparent, secondary
} from "../../../config/colors";
import autoFieldSelector from "../../../modules/autoFieldSelector";
import { operations, operators } from "../../../modules/filterOperations";
import DraggableLabel from "./DraggableLabel";
import TableDataFormattingModal from "./TableDataFormattingModal";
import DatasetAlerts from "./DatasetAlerts";
import Text from "../../../components/Text";
import Row from "../../../components/Row";
import { useParams } from "react-router";

function formatColumnsForOrdering(columns) {
  if (!columns) {
    return [];
  }
  return columns.map((column, index) => ({
    id: index,
    Header: column,
  }));
}

function DatasetData(props) {
  const {
    dataset, onUpdate, chartType, chartData,
    dataLoading, datasetResponses,
  } = props;

  const [fieldOptions, setFieldOptions] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [formula, setFormula] = useState("");
  const [goal, setGoal] = useState(null);
  const [tableFields, setTableFields] = useState([]);
  const [isDragState, setIsDragState] = useState(false);
  const [tableColumns, setTableColumns] = useState([]);
  const [xFieldFilter, setXFieldFilter] = useState("");
  const [yFieldFilter, setYFieldFilter] = useState("");
  const [dateFieldFilter, setDateFieldFilter] = useState("");
  const [conditionModal, setConditionModal] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState({});
  const [requestResult, setRequestResult] = useState(null);
  const [datasetMaxRecords, setDatasetMaxRecords] = useState(null);

  const [fieldForFormatting, setFieldForFormatting] = useState("");
  const [fieldFormatConfig, setFieldFormatConfig] = useState(null);
  const [fieldFormatLoading, setFieldFormatLoading] = useState(false);

  const yFieldRef = useRef(null);
  const xFieldRef = useRef(null);
  const dateFieldRef = useRef(null);
  const params = useParams();

  // Update the content when there is some data to work with
  useEffect(() => {
    if (requestResult) {
      let tempFieldOptions = [];
      const tempObjectOptions = [];
      const fieldsSchema = {};
      const updateObj = {};

      const fields = fieldFinder(requestResult);
      const objectFields = fieldFinder(requestResult, false, true);

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
        onUpdate(updateObj);
      }
    }
  }, [requestResult]);

  // Update the conditions
  useEffect(() => {
    if (dataset.conditions && dataset.conditions.length > 0) {
      let newConditions = [...conditions];

      // in case of initialisation, remove the first empty condition
      if (newConditions.length === 1 && !newConditions[0].saved && !newConditions[0].value) {
        newConditions = [];
      }

      const toAddConditions = [];
      for (let i = 0; i < dataset.conditions.length; i++) {
        let found = false;
        for (let j = 0; j < newConditions.length; j++) {
          if (newConditions[j].id === dataset.conditions[i].id) {
            newConditions[j] = _.clone(dataset.conditions[i]);
            found = true;
          }
        }

        if (!found) toAddConditions.push(dataset.conditions[i]);
      }

      setConditions(newConditions.concat(toAddConditions));
    }

    if (dataset.formula) {
      setFormula(dataset.formula);
    }

    if (dataset.goal) {
      setGoal(dataset.goal);
    }

    if (dataset.fieldsSchema) {
      const tempFieldOptions = [];
      Object.keys(dataset.fieldsSchema).forEach((key) => {
        const type = dataset.fieldsSchema[key];
        tempFieldOptions.push({
          key,
          text: key && key.replace("root[].", "").replace("root.", ""),
          value: key,
          type,
          isObject: key.indexOf("[]") === -1,
          label: {
            style: { width: 55, textAlign: "center" },
            content: type || "unknown",
            size: "mini",
            color: type === "date" ? "secondary"
              : type === "number" ? "primary"
                : type === "string" ? "success"
                  : type === "boolean" ? "warning"
                    : "default"
          },
        });
      });

      setFieldOptions(tempFieldOptions);
    }

    if (dataset.columnsOrder) {
      const notFoundColumns = [];
      const datasetData = chartData[dataset.legend];
      if (datasetData && datasetData.columns) {
        datasetData.columns.forEach((field) => {
          if (!dataset.columnsOrder.find((column) => column === field.Header)) {
            notFoundColumns.push(field.Header);
          }
        });
      }

      setTableColumns(formatColumnsForOrdering(dataset.columnsOrder.concat(notFoundColumns)));
    }
  }, [dataset]);

  useEffect(() => {
    // extract the table fields if table view is selected
    if (chartType === "table" && chartData && chartData[dataset.legend]) {
      const datasetData = chartData[dataset.legend];
      const flatColumns = _.flatMap(datasetData.columns, (f) => {
        if (f.columns) return [f, ...f.columns];
        return f;
      });
      setTableFields(flatColumns);
    }
  }, [chartData]);

  useEffect(() => { if (!dataLoading) setIsDragState(false); }, [dataLoading]);

  useEffect(() => {
    if (datasetResponses.length > 0) {
      const dResponse = datasetResponses.find((response) => response.dataset_id === dataset.id);
      if (dResponse?.data) setRequestResult(dResponse.data);
    }
  }, [datasetResponses]);

  const _selectXField = (key) => {
    onUpdate({ xAxis: key });
    setXFieldFilter("");
  };

  const _selectYField = (key) => {
    onUpdate({ yAxis: key });
    setYFieldFilter("");
  };

  const _selectYOp = (key) => {
    onUpdate({ yAxisOperation: key });
  };

  const _selectDateField = (key) => {
    onUpdate({ dateField: key });
    setDateFieldFilter("");
  };

  const _updateCondition = (id, data, type, dataType) => {
    const newConditions = conditions.map((condition) => {
      const newCondition = condition;
      if (condition.id === id) {
        newCondition[type] = data;
        newCondition.saved = false;

        if (type === "field") {
          newCondition.value = "";
        }

        if (dataType) newCondition.type = dataType;
      }

      return newCondition;
    });

    setConditions(newConditions);
  };

  const _onHideCondition = (id) => {
    const newConditions = conditions.map((condition) => {
      const newCondition = condition;
      if (condition.id === id) {
        newCondition.exposed = false;
      }

      return newCondition;
    });

    onUpdate({ conditions: newConditions });
  };

  const _onApplyCondition = (id, exposed, dataType) => {
    const newConditions = conditions.map((item) => {
      const newItem = { ...item };
      if (item.id === id) {
        newItem.saved = true;
        newItem.exposed = !!exposed;

        if (dataType) newItem.type = dataType;
      }

      return newItem;
    });

    _onSaveConditions(newConditions);
  };

  const _onRevertCondition = (id) => {
    const newConditions = conditions.map((item) => {
      let newItem = { ...item };
      if (item.id === id) {
        const previousItem = _.find(dataset.conditions, { id });
        newItem = { ...previousItem };
      }

      return newItem;
    });

    setConditions(newConditions);
  };

  const _onAddCondition = () => {
    const newConditions = [...conditions, {
      id: uuid(),
      field: "",
      operator: "is",
      value: "",
      saved: false,
      displayValues: true,
    }];

    setConditions(newConditions);
  };

  const _onRemoveCondition = (id) => {
    let newConditions = [...conditions];
    newConditions = newConditions.filter((condition) => condition.id !== id);

    setConditions(newConditions);
    _onSaveConditions(newConditions);
  };

  const _onSaveConditions = (newConditions) => {
    const savedConditions = newConditions.filter((item) => item.saved);
    onUpdate({ conditions: savedConditions });
  };

  const _onEditConditionSettings = (condition) => {
    setSelectedCondition(condition);
    setConditionModal(true);
  };

  const _onConfirmConditionSettings = () => {
    const newConditions = conditions.map((item) => {
      let newItem = { ...item };
      if (item.id === selectedCondition.id) {
        newItem = { ...selectedCondition };
      }

      return newItem;
    });

    onUpdate({ conditions: newConditions });
    setSelectedCondition({});
    setConditionModal(false);
  };

  const _onAddFormula = () => {
    setFormula("{val}");
  };

  const _onExampleFormula = () => {
    setFormula("${val / 100}");
    onUpdate({ formula: "${val / 100}" });
  };

  const _onRemoveFormula = () => {
    setFormula("");
    onUpdate({ formula: "" });
  };

  const _onApplyFormula = () => {
    onUpdate({ formula });
  };

  const _onAddGoal = () => {
    setGoal(100);
  };

  const _onRemoveGoal = () => {
    setGoal(null);
    onUpdate({ goal: null });
  };

  const _onApplyGoal = () => {
    onUpdate({ goal });
  };

  const _onExcludeField = (field) => {
    const excludedFields = dataset.excludedFields || [];
    const newExcludedFields = [...excludedFields, field];
    onUpdate({ excludedFields: newExcludedFields });
  };

  const _onShowField = (field) => {
    const excludedFields = dataset.excludedFields || [];
    const index = _.indexOf(excludedFields, field);
    excludedFields.splice(index, 1);
    onUpdate({ excludedFields });
  };

  const _onSumField = (field) => {
    if (dataset.configuration) {
      const newConfiguration = { ...dataset.configuration };
      newConfiguration.sum = field;
      if (dataset.configuration.sum === field) {
        delete newConfiguration.sum;
      }
      onUpdate({ configuration: newConfiguration });
    } else {
      onUpdate({ configuration: { sum: field } });
    }
  };

  const _filterOptions = (axis) => {
    let filteredOptions = fieldOptions;
    if (axis === "x" && chartType !== "table") {
      filteredOptions = filteredOptions.filter((f) => {
        if (f.type === "array" || (f.value && f.value.split("[]").length > 2)) {
          return false;
        }

        return true;
      });
    }

    if (axis === "x" && xFieldFilter) {
      filteredOptions = filteredOptions
        .filter((o) => o.text?.toString().toLowerCase().includes(xFieldFilter.toLowerCase()));
    }

    if (chartType !== "table") return filteredOptions;

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
    if (!yFieldFilter) return fieldOptions;

    return fieldOptions
      .filter((o) => o.text?.toString().toLowerCase().includes(yFieldFilter.toLowerCase()));
  };

  const _getDateFieldOptions = () => {
    let filteredOptions = fieldOptions.filter((f) => f.type === "date");

    if (dateFieldFilter) {
      filteredOptions = filteredOptions
        .filter((o) => o.text?.toString().toLowerCase().includes(dateFieldFilter.toLowerCase()));
    }

    return filteredOptions;
  };

  const _onDragStateClicked = () => {
    setIsDragState(!isDragState);

    const columnsForOrdering = [];
    if (!isDragState && (!dataset.columnsOrder || dataset.columnsOrder.length === 0)) {
      const datasetData = chartData[dataset.legend];
      if (datasetData && datasetData.columns) {
        datasetData.columns.forEach((field, index) => {
          if (field && field.Header && field.Header.indexOf("__cb_group") === -1) {
            columnsForOrdering.push({
              Header: field.Header,
              id: index,
            });
          }
        });
      }

      setTableColumns(columnsForOrdering);
    } else {
      const notFoundColumns = [];
      const datasetData = chartData[dataset.legend];
      if (datasetData && datasetData.columns) {
        datasetData.columns.forEach((field) => {
          if (!dataset.columnsOrder.find((column) => column === field.Header)) {
            notFoundColumns.push(field.Header);
          }
        });
      }

      setTableColumns(formatColumnsForOrdering(dataset.columnsOrder.concat(notFoundColumns)));
    }
  };

  const _onMoveLabel = useCallback((dragIndex, hoverIndex) => {
    setTableColumns((prevColumns) => update(prevColumns, {
      $splice: [
        [dragIndex, 1],
        [hoverIndex, 0, prevColumns[dragIndex]],
      ],
    }),);
  }, []);

  const _onConfirmColumnOrder = () => {
    const newColumnsOrder = [];
    tableColumns.forEach((column) => {
      newColumnsOrder.push(column.Header);
    });
    onUpdate({ columnsOrder: newColumnsOrder });
  };

  const _onCancelColumnOrder = () => {
    setIsDragState(false);
    setTableColumns(formatColumnsForOrdering(dataset.columnsOrder));
  };

  const _onSelectFieldForFormatting = (field) => {
    if (dataset?.configuration?.columnsFormatting?.[field]) {
      setFieldFormatConfig(dataset.configuration.columnsFormatting[field]);
    }

    setFieldForFormatting(field);
  };

  const _onUpdateFieldFormatting = async (config) => {
    const newConfiguration = { ...dataset.configuration };
    if (!newConfiguration.columnsFormatting) {
      newConfiguration.columnsFormatting = {};
    }

    newConfiguration.columnsFormatting[fieldForFormatting] = config;

    setFieldFormatLoading(true);
    await onUpdate({ configuration: newConfiguration });

    setFieldFormatLoading(false);
    setFieldForFormatting("");
    setFieldFormatConfig(null);
  };

  if ((!fieldOptions || !dataset.fieldsSchema)) {
    return (
      <Row>
        <Text size="h4">
          {"Click on the \"Get data\" button above to get started."}
        </Text>
      </Row>
    );
  }

  return (
    <>
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-12 md:col-span-6 datasetdata-axes-tut">
          <div style={styles.rowDisplay}>
            <Text>
              {chartType === "table" ? "Collection " : "Dimension"}
            </Text>
            {chartType !== "table" && dataset.xAxis && !_filterOptions("x").find((o) => o.value === dataset.xAxis) && (
              <>
                <Spacer x={0.3} />
                <Tooltip content="The selected field is not available in the data. Please select another.">
                  <div>
                    <LuTriangleAlert className="text-warning" />
                  </div>
                </Tooltip>
              </>
            )}
          </div>
          <div style={styles.rowDisplay}>
            <Popover>
              <PopoverTrigger>
                <Input
                  value={dataset.xAxis?.substring(dataset.xAxis.lastIndexOf(".") + 1)}
                  fullWidth
                  placeholder="Double-click to search"
                  ref={xFieldRef}
                  endContent={<LuChevronDown />}
                  variant="bordered"
                />
              </PopoverTrigger>
              <PopoverContent>
                <div className="pt-4">
                  <Input
                    placeholder="Search"
                    endContent={<LuSearch />}
                    variant="bordered"
                    fullWidth
                    onChange={(e) => setXFieldFilter(e.target.value)}
                    value={xFieldFilter}
                    autoFocus
                  />
                  <Spacer y={1} />
                  <ScrollShadow className="max-h-[400px]">
                    <Listbox
                      onSelectionChange={(keys) => _selectXField(keys.currentKey)}
                      selectedKeys={[dataset.xAxis]}
                      selectionMode="single"
                      aria-label="Select a dimension"
                    >
                      {_filterOptions("x").map((option) => (
                        <ListboxItem
                          key={option.value}
                          startContent={(
                            <Chip size="sm" variant="flat" className={"min-w-[70px] text-center"} color={option.label.color}>{option.label.content}</Chip>
                          )}
                          description={option.isObject ? "Key-Value visualization" : null}
                        >
                          {option.text}
                        </ListboxItem>
                      ))}
                    </Listbox>
                  </ScrollShadow>
                </div>
              </PopoverContent>
            </Popover>
            {chartType === "table" && (
              <>
                <Spacer x={0.2} />
                <Tooltip
                  content="Select a collection (array) of objects to display in a table format. 'Root' means the first level of the collection."
                >
                  <div>
                    <LuInfo />
                  </div>
                </Tooltip>
              </>
            )}
          </div>
        </div>
        <div className="col-span-12 md:col-span-6 datasetdata-date-tut" direction="column">
          <div style={styles.rowDisplay}>
            <Text>{"Date filtering field"}</Text>
            {dataset.dateField
              && !_getDateFieldOptions().find((o) => o.value === dataset.dateField) && (
              <>
                <Spacer x={0.3} />
                <Tooltip content="The selected field is not available in the data. Please select another.">
                  <div>
                    <LuTriangleAlert className="text-warning" />
                  </div>
                </Tooltip>
              </>
            )}
          </div>
          <div style={{ flexDirection: "row", display: "flex", alignItems: "center" }}>
            <Popover>
              <PopoverTrigger>
                <Input
                  value={dataset.dateField?.substring(dataset.dateField.lastIndexOf(".") + 1)}
                  fullWidth
                  placeholder="Select a date field"
                  ref={dateFieldRef}
                  endContent={<LuChevronDown />}
                  variant="bordered"
                />
              </PopoverTrigger>
              <PopoverContent>
                <div className="pt-4">
                  <Input
                    placeholder="Search"
                    endContent={<LuSearch />}
                    variant="bordered"
                    fullWidth
                    onChange={(e) => setDateFieldFilter(e.target.value)}
                    value={dateFieldFilter}
                    autoFocus
                  />
                  <ScrollShadow className="max-h-[400px]">
                    <Listbox
                      variant="bordered"
                      onSelectionChange={(keys) => _selectDateField(keys.currentKey)}
                      selectedKeys={[dataset.dateField]}
                      selectionMode="single"
                      aria-label="Select a date field"
                    >
                      {_getDateFieldOptions().map((option) => (
                        <ListboxItem
                          key={option.value}
                          startContent={(
                            <Chip size="sm" variant="flat" className={"min-w-[70px] text-center"} color={option.label.color}>{option.label.content}</Chip>
                          )}
                          description={option.isObject ? "Key-Value visualization" : null}
                        >
                          {option.text}
                        </ListboxItem>
                      ))}
                    </Listbox>
                  </ScrollShadow>
                </div>
              </PopoverContent>
            </Popover>
            <Spacer x={0.5} />
            {dataset.dateField && (
              <Tooltip content="Clear field">
                <Link onClick={() => onUpdate({ dateField: "" })} className="text-danger">
                  <LuCircleX />
                </Link>
              </Tooltip>
            )}
          </div>
        </div>
        {chartType !== "table" && (
          <>
            <div className="col-span-12 md:col-span-6">
              <div style={styles.rowDisplay}>
                <Text>
                  Metric
                </Text>
                {dataset.yAxis && !_getYFieldOptions().find((o) => o.value === dataset.yAxis) && (
                  <>
                    <Spacer x={0.6} />
                    <Tooltip content="The selected field is not available in the data. Please select another.">
                      <div><LuTriangleAlert className="text-danger" /></div>
                    </Tooltip>
                  </>
                )}
              </div>
              <div>
                <Popover>
                  <PopoverTrigger disabled={fieldOptions.find((o) => o.key === dataset.xAxis)?.isObject}>
                    <Input
                      disabled={fieldOptions.find((o) => o.key === dataset.xAxis)?.isObject}
                      value={dataset.yAxis?.substring(dataset.yAxis.lastIndexOf(".") + 1)}
                      fullWidth
                      ref={yFieldRef}
                      endContent={<LuChevronDown />}
                      variant="bordered"
                    />
                  </PopoverTrigger>
                  <PopoverContent className="">
                    <div className="pt-4">
                      <Input
                        placeholder="Search"
                        endContent={<LuSearch />}
                        variant="bordered"
                        fullWidth
                        onChange={(e) => setYFieldFilter(e.target.value)}
                        value={yFieldFilter}
                        autoFocus
                      />
                      <ScrollShadow className="max-h-[400px]">
                        <Listbox
                          variant="bordered"
                          onSelectionChange={(keys) => _selectYField(keys.currentKey)}
                          selectedKeys={[dataset.yAxis]}
                          selectionMode="single"
                          aria-label="Select a metric"
                        >
                          {_getYFieldOptions().map((option) => (
                            <ListboxItem
                              key={option.value}
                              startContent={(
                                <Chip size="sm" variant="flat" className={"min-w-[70px] text-center"} color={option.label.color}>{option.label.content}</Chip>
                              )}
                              description={option.isObject ? "Key-Value visualization" : null}
                            >
                              {option.text}
                            </ListboxItem>
                          ))}
                        </Listbox>
                      </ScrollShadow>
                    </div>
                  </PopoverContent>
                </Popover>
                <Spacer y={2} />
                <Select
                  placeholder="Operation"
                  size="sm"
                  onSelectionChange={(keys) => _selectYOp(keys.currentKey)}
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
              </div>
            </div>
            <div className="col-span-12 md:col-span-6">
              <div>
                <Text>Sort records</Text>
              </div>
              <div style={styles.rowDisplay}>
                <Tooltip content="Sort the dataset in ascending order">
                  <Button
                    color={dataset.sort === "asc" ? "secondary" : "default"}
                    variant={dataset.sort !== "asc" ? "bordered" : "solid"}
                    onClick={() => {
                      if (dataset.sort === "asc") {
                        onUpdate({ sort: "" });
                      } else {
                        onUpdate({ sort: "asc" });
                      }
                    }}
                    isIconOnly
                  >
                    <LuArrowDown01 />
                  </Button>
                </Tooltip>
                <Spacer x={0.5} />
                <Tooltip content="Sort the dataset in descending order">
                  <Button
                    color={dataset.sort === "desc" ? "secondary" : "default"}
                    variant={dataset.sort !== "desc" ? "bordered" : "solid"}
                    onClick={() => {
                      if (dataset.sort === "desc") {
                        onUpdate({ sort: "" });
                      } else {
                        onUpdate({ sort: "desc" });
                      }
                    }}
                    isIconOnly
                  >
                    <LuArrowDown10 />
                  </Button>
                </Tooltip>
                {dataset.sort && (
                  <>
                    <Spacer x={0.5} />
                    <Tooltip content="Clear sorting">
                      <Link className="text-danger" onClick={() => onUpdate({ sort: "" })}>
                        <LuCircleX className="text-danger" />
                      </Link>
                    </Tooltip>
                  </>
                )}
              </div>
              <Spacer y={1} />
              {dataset.yAxisOperation === "avg" && (
                <div>
                  <Text>Average by the total items on the chart</Text>
                  <Switch
                    size="sm"
                    isSelected={dataset.averageByTotal}
                    onChange={() => onUpdate({ averageByTotal: !dataset.averageByTotal })}
                  />
                </div>
              )}
              {dataset.sort && (
                <>
                  <div>
                    <Text>{"Max number of records"}</Text>
                  </div>
                  <div style={styles.rowDisplay}>
                    <Input
                      endContent="records"
                      variant="bordered"
                      size="sm"
                      defaultValue={dataset.maxRecords}
                      value={datasetMaxRecords || dataset.maxRecords || ""}
                      onChange={(e) => setDatasetMaxRecords(e.target.value)}
                    />
                    <Spacer x={0.5} />
                    <Tooltip content="Save">
                      <Link className="text-success" onClick={() => onUpdate({ maxRecords: datasetMaxRecords })}>
                        <LuCircleCheck className="text-success" />
                      </Link>
                    </Tooltip>
                    <Spacer x={0.5} />
                    <Tooltip content="Clear limit">
                      <Link
                        className="text-danger"
                        onClick={() => {
                          onUpdate({ maxRecords: null });
                          setDatasetMaxRecords(null);
                        }}
                      >
                        <LuCircleX className="text-danger" />
                      </Link>
                    </Tooltip>
                  </div>
                </>
              )}
            </div>
            <div className="col-span-12 mt-4">
              {!formula && (
                <Link onClick={_onAddFormula} className="flex items-center cursor-pointer">
                  <TbMathFunctionY size={24} />
                  <Spacer x={0.5} />
                  <Text>Apply formula on metric</Text>
                </Link>
              )}
            </div>
          </>
        )}
        {formula && (
          <div className="col-span-12">
            <div>
              <Popover>
                <PopoverTrigger>
                  <div className="flex flex-row gap-2 items-center">
                    <Text>
                      {"Metric formula"}
                    </Text>
                    <LuInfo />
                  </div>
                </PopoverTrigger>
                <PopoverContent>
                  <FormulaTips />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-row gap-2 items-center">
              <Input
                placeholder="Enter your formula here: {val}"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                variant="bordered"
              />
              <Tooltip
                content={formula === dataset.formula ? "The formula is already applied" : "Apply the formula"}
              >
                <Link onClick={formula === dataset.formula ? () => { } : _onApplyFormula}>
                  <LuCircleCheck className={`${formula === dataset.formula ? "text-default-foreground" : "text-success"}`} />
                </Link>
              </Tooltip>
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
        )}
        {!goal && chartType !== "table" && (
          <div className="col-span-12 mt-4">
            <Link onClick={_onAddGoal} className="flex items-center cursor-pointer">
              <TbProgressCheck size={24} />
              <Spacer x={0.5} />
              <Text>Set a goal</Text>
            </Link>
          </div>
        )}
        {goal && chartType !== "table" && (
          <div className="col-span-12 mt-4">
            <Row align="center">
              <Text>{"Goal "}</Text>
              <Spacer x={0.5} />
              <Tooltip content="A goal can be displayed as a progress bar in your KPI charts. Enter a number without any other characters. (e.g. 1000 instead of 1k)">
                <div><LuInfo /></div>
              </Tooltip>
            </Row>
            <Row align="center" className={"gap-2"}>
              <Input
                placeholder="Enter your goal here"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                variant="bordered"
              />
              <Tooltip
                content={goal === dataset.goal ? "The goal is already applied" : "Save goal"}
              >
                <Link onClick={goal === dataset.goal ? () => { } : _onApplyGoal}>
                  <LuCircleCheck className={goal === dataset.goal ? "text-foreground" : "text-success"} />
                </Link>
              </Tooltip>
              <Tooltip content="Remove goal">
                <Link onClick={_onRemoveGoal}>
                  <LuCircleX className="text-danger" />
                </Link>
              </Tooltip>
            </Row>
          </div>
        )}
        {chartType === "table" && (
          <>
            <div className="col-span-12 mt-4">
              <Accordion fullWidth variant="bordered">
                <AccordionItem subtitle="Table columns options" className="text-default" indicator={<LuSettings />}>
                  <div>
                    {!isDragState && (
                      <Row wrap="wrap">
                        {tableFields.map((field) => {
                          if (!field || !field.accessor || field.Header.indexOf("__cb_group") > -1) return (<span key={field.accessor} />);
                          return (
                            <Chip
                              key={field.accessor}
                              color={dataset?.configuration?.sum === field.accessor ? "secondary" : "default"}
                              variant={dataset?.configuration?.sum === field.accessor ? "faded" : "solid"}
                              className="mr-3 min-w-[70px] mb-3"
                              startContent={(
                                <Link
                                  className="flex items-center"
                                  onClick={() => _onExcludeField(field.accessor)}
                                  title="Hide field"
                                >
                                  <LuEye />
                                </Link>
                              )}
                              endContent={(
                                <Dropdown aria-label="Select a table column option">
                                  <DropdownTrigger>
                                    <Link
                                      className="flex items-center"
                                      title="Sum values on this field"
                                    >
                                      <LuCircleChevronDown />
                                    </Link>
                                  </DropdownTrigger>
                                  <DropdownMenu variant="bordered">
                                    <DropdownItem startContent={<LuSettings />} textValue="Data formatting">
                                      <Link className="w-full" onClick={() => _onSelectFieldForFormatting(field.accessor)}>
                                        <Text>Data formatting</Text>
                                      </Link>
                                    </DropdownItem>
                                    <DropdownItem startContent={<LuPlus />} textValue="Enable sum calculation">
                                      <Link className="w-full" onClick={() => _onSumField(field.accessor)}>
                                        {dataset.configuration
                                          && dataset.configuration.sum === field.accessor
                                          && (
                                            <Text>Disable sum calculation</Text>
                                          )}
                                        {(!dataset.configuration
                                          || dataset.configuration.sum !== field.accessor)
                                          && (
                                            <Text>Enable sum calculation</Text>
                                          )}
                                      </Link>
                                    </DropdownItem>
                                  </DropdownMenu>
                                </Dropdown>
                              )}
                            >
                              {`${field.accessor.replace("?", ".")}`}
                            </Chip>
                          );
                        })}
                      </Row>
                    )}

                    {isDragState && tableColumns.length > 0 && (
                      <DndProvider backend={HTML5Backend} key={1} context={window}>
                        <Row wrap="wrap" align="center">
                          {tableColumns.map((field, index) => {
                            // check if the field is found in the excluded fields
                            if (dataset.excludedFields
                              && dataset.excludedFields.find((i) => i === field.Header)
                            ) {
                              return (<span key={field.Header} />);
                            }

                            return (
                              <DraggableLabel
                                key={field.Header}
                                field={field}
                                index={index}
                                onMove={_onMoveLabel}
                              />
                            );
                          })}
                        </Row>
                      </DndProvider>
                    )}

                    {!isDragState
                        && dataset.excludedFields
                        && dataset.excludedFields.length > 0
                        && (
                          <Spacer y={1} />
                        )}

                    <Row wrap="wrap" align="center">
                      {!isDragState
                        && dataset.excludedFields
                        && dataset.excludedFields.map((field) => (
                          <Chip
                            key={field}
                            onClick={() => _onShowField(field)}
                            color="warning"
                            variant="faded"
                            startContent={(
                              <Link className="flex items-center text-warning" onClick={() => _onShowField(field)}>
                                <LuEyeOff />
                              </Link>
                            )}
                          >
                            {field.replace("?", ".")}
                          </Chip>
                        ))}
                    </Row>
                    <Spacer y={2} />
                    <Row>
                      <Button
                        color={isDragState ? "success" : "primary"}
                        variant="bordered"
                        onClick={isDragState ? _onConfirmColumnOrder : _onDragStateClicked}
                        isLoading={dataLoading}
                        auto
                        size="sm"
                        startContent={<TbDragDrop size={20} />}
                      >
                        {isDragState ? "Confirm ordering" : "Reorder columns"}
                      </Button>
                      {isDragState && (
                        <>
                          <Spacer x={0.2} />
                          <Button
                            isIconOnly
                            variant="flat"
                            color={"danger"}
                            onClick={_onCancelColumnOrder}
                            title="Cancel ordering"
                            size="sm"
                          >
                            <LuCircleX />
                          </Button>
                        </>
                      )}
                    </Row>
                  </div>
                </AccordionItem>
              </Accordion>
            </div>
          </>
        )}

        {chartType !== "table" && (
          <>
            <div className="col-span-12">
              <Spacer y={2} />
              <Divider />
              <Spacer y={2} />
            </div>

            <div className="col-span-12">
              <Text b>Alerts</Text>
              <Spacer y={1} />
              <DatasetAlerts
                chartType={chartType === "pie"
                    || chartType === "radar"
                    || chartType === "polar"
                    || chartType === "doughnut"
                    || chartType === "table"
                  ? "patterns" : "axis"}
                chartId={params.chartId}
                datasetId={dataset.id}
                projectId={params.projectId}
              />
            </div>
          </>
        )}

        <div className="col-span-12">
          <Spacer y={2} />
          <Divider />
          <Spacer y={2} />
        </div>
        {conditions && conditions.length === 0 && (
          <div className="col-span-12 datasetdata-filters-tut">
            <Row>
              <Text b>{"Filters"}</Text>
            </Row>
            <Spacer y={1} />

            <Button
              variant="bordered"
              startContent={<LuFilter />}
              onClick={_onAddCondition}
              auto
              size={"sm"}
            >
              Add data filters
            </Button>
          </div>
        )}
        {conditions.map((condition, index) => {
          return (
            <div key={condition.id} className="col-span-12 datasetdata-filters-tut">
              <div>
                <Row warp="wrap" className={"flex gap-2"} align="center">
                  {index === 0 && (<Text>{"where "}</Text>)}
                  {index > 0 && (<Text>{"and "}</Text>)}
                  <Spacer x={1} />
                  <Popover>
                    <PopoverTrigger>
                      <Input
                        value={condition.field && condition.field.substring(condition.field.lastIndexOf(".") + 1) || "field"}
                        size="sm"
                        endContent={<LuChevronDown />}
                      />
                    </PopoverTrigger>
                    <PopoverContent>
                      <div>
                        <Listbox
                          onSelectionChange={(keys) => _updateCondition(condition.id, keys.currentKey, "field")}
                          selectedKeys={[condition.field]}
                          selectionMode="single"
                          aria-label="Select a field"
                        >
                          {fieldOptions.filter((f) => !f.isObject).map((field) => (
                            <ListboxItem
                              key={field.value}
                              startContent={(
                                <Chip size="sm" variant="flat" className={"min-w-[70px] text-center"} color={field.label.color}>{field.label.content}</Chip>
                              )}
                              textValue={field.text}
                            >
                              {field.text}
                            </ListboxItem>
                          ))}
                        </Listbox>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Dropdown aria-label="Select an operator">
                    <DropdownTrigger>
                      <Input
                        value={
                          (
                            _.find(operators, { value: condition.operator })
                            && _.find(operators, { value: condition.operator }).key
                          )
                          || "="
                        }
                        size="sm"
                        className="max-w-[100px]"
                      />
                    </DropdownTrigger>
                    <DropdownMenu
                      onAction={(key) => _updateCondition(condition.id, key, "operator")}
                      selectedKeys={[condition.operator]}
                      selectionMode="single"
                    >
                      {operators.map((operator) => (
                        <DropdownItem key={operator.value} textValue={operator.text}>
                          {operator.text}
                        </DropdownItem>
                      ))}
                    </DropdownMenu>
                  </Dropdown>
                  <div className="min-w-[150px]">
                    {(!condition.field
                      || (_.find(fieldOptions, { value: condition.field })
                      && _.find(fieldOptions, { value: condition.field }).type !== "date")) && (
                      <Input
                        placeholder="Enter a value"
                        value={condition.value}
                        onChange={(e) => _updateCondition(condition.id, e.target.value, "value", _.find(fieldOptions, { value: condition.field }))}
                        disabled={(condition.operator === "isNotNull" || condition.operator === "isNull")}
                        size="sm"
                      />
                    )}
                    {_.find(fieldOptions, { value: condition.field })
                      && _.find(fieldOptions, { value: condition.field }).type === "date" && (
                      <Popover>
                        <PopoverTrigger>
                          <Input
                            endContent={<LuCalendarDays />}
                            placeholder="Enter a value"
                            value={(condition.value && format(new Date(condition.value), "Pp", { locale: enGB })) || "Enter a value"}
                            disabled={(condition.operator === "isNotNull" || condition.operator === "isNull")}
                            size="sm"
                          />
                        </PopoverTrigger>
                        <PopoverContent>
                          <Calendar
                            date={(condition.value && new Date(condition.value)) || new Date()}
                            onChange={(date) => _updateCondition(condition.id, formatISO(date), "value", _.find(fieldOptions, { value: condition.field }).type)}
                            locale={enGB}
                            color={secondary}
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  <Tooltip content="Remove condition">
                    <Link color="danger" onClick={() => _onRemoveCondition(condition.id)}>
                      <LuCircleX className="text-danger" />
                    </Link>
                  </Tooltip>

                  {condition.field && condition.operator && !condition.exposed && (
                    <Tooltip content="Expose filter to viewers" color={"foreground"}>
                      <Link
                        color="secondary"
                        onClick={() => _onApplyCondition(
                          condition.id,
                          true,
                          _.find(fieldOptions, { value: condition.field })
                            && _.find(fieldOptions, { value: condition.field }).type
                        )}
                      >
                        <LuEye className="text-secondary" />
                      </Link>
                    </Tooltip>
                  )}

                  {condition.field && condition.operator && condition.exposed && (
                    <Tooltip content="Hide this filter from viewers">
                      <Link
                        color="secondary"
                        onClick={() => _onApplyCondition(
                          condition.id,
                          false,
                          _.find(fieldOptions, { value: condition.field })
                            && _.find(fieldOptions, { value: condition.field }).type
                        )}
                      >
                        <LuEyeOff className="text-secondary" />
                      </Link>
                    </Tooltip>
                  )}

                  {!condition.saved && condition.field && (
                    <Tooltip content="Apply this condition">
                      <Link
                        color="success"
                        onClick={() => _onApplyCondition(condition.id, condition.exposed)}
                      >
                        <LuCircleCheck className="text-success" />
                      </Link>
                    </Tooltip>
                  )}
                  {!condition.saved && condition.value && (
                    <Tooltip content="Undo changes">
                      <Link
                        color="warning"
                        onClick={() => _onRevertCondition(condition.id)}
                      >
                        <LuRedo />
                      </Link>
                    </Tooltip>
                  )}
                  {condition.saved && (
                    <Tooltip content="Condition settings">
                      <Link
                        className="text-default-800"
                        onClick={() => _onEditConditionSettings(condition)}
                      >
                        <LuSettings />
                      </Link>
                    </Tooltip>
                  )}
                </Row>
              </div>
            </div>
          );
        })}
        {conditions?.length > 0 && (
          <div className="col-span-12">
            <Button
              variant="light"
              color="primary"
              onClick={_onAddCondition}
              startContent={<LuPlus />}
              size="sm"
            >
              Add a new condition
            </Button>
          </div>
        )}
        {conditions.filter((c) => c.exposed).length > 0 && (
          <div className="col-span-12">
            <div><Text>{"Exposed filters on the chart"}</Text></div>
            <Spacer y={0.5} />
            <div>
              {conditions.filter((c) => c.exposed).map((condition) => {
                return (
                  <Chip
                    key={condition.id}
                    color={"primary"}
                    variant="faded"
                    size="sm"
                    endContent={(
                      <Link onClick={() => _onHideCondition(condition.id)} color="danger">
                        <LuCircleX />
                      </Link>
                    )}
                  >
                    {condition.field.replace("root[].", "")}
                  </Chip>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={conditionModal} size="lg" onClose={() => setConditionModal(false)}>
        <ModalContent>
          <ModalHeader>
            <Text size="h4">Condition settings</Text>
          </ModalHeader>
          <ModalBody>
            <Row>
              <Input
                label="The name of the filter as it appears to viewers"
                placeholder="Enter a name"
                onChange={(e) => {
                  setSelectedCondition({ ...selectedCondition, displayName: e.target.value });
                }}
                value={
                  selectedCondition.displayName
                  || (selectedCondition.field && selectedCondition.field.substring(selectedCondition.field.lastIndexOf(".") + 1))
                  || ""
                }
                fullWidth
                variant="bordered"
              />
            </Row>
            <Row>
              <Checkbox
                title="Hide existing values from the filter dropdown"
                isSelected={selectedCondition.hideValues}
                onChange={() => {
                  setSelectedCondition({
                    ...selectedCondition,
                    hideValues: !selectedCondition.hideValues
                  });
                }}
                size="sm"
              >
                Hide existing values from the filter dropdown
              </Checkbox>
            </Row>
          </ModalBody>
          <ModalFooter>
            <Button
              onClick={() => setConditionModal(false)}
              color="warning"
              variant="flat"
            >
              Close
            </Button>
            <Button
              onClick={_onConfirmConditionSettings}
              color="primary"
            >
              Save settings
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <TableDataFormattingModal
        config={fieldFormatConfig}
        open={!!fieldForFormatting}
        onClose={() => {
          setFieldForFormatting("");
          setFieldFormatConfig(null);
        }}
        onUpdate={_onUpdateFieldFormatting}
        loading={fieldFormatLoading}
      />
    </>
  );
}

DatasetData.defaultProps = {
  chartType: "",
  chartData: null,
  dataLoading: false,
};

DatasetData.propTypes = {
  dataset: PropTypes.object.isRequired,
  chartType: PropTypes.string,
  chartData: PropTypes.object,
  onUpdate: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  dataLoading: PropTypes.bool,
  datasetResponses: PropTypes.array.isRequired,
};

function FormulaTips() {
  return (
    <div className={"p-4"}>
      <Row>
        <Text b>{"Formulas allow you to manipulate the final results on the Y-Axis"}</Text>
      </Row>
      <Spacer y={1} />
      <Row>
        <Text>{"For"}</Text>
        <Spacer x={0.5} />
        <Text b>{"val = 12345"}</Text>
      </Row>
      <Spacer y={1} />
      <Row align="center">
        <LuChevronRight />
        <Spacer x={0.5} />
        <Text>
          {"{val} => 12345"}
        </Text>
      </Row>
      <Spacer y={1} />
      <Row align="center">
        <LuChevronRight />
        <Spacer x={0.5} />
        <Text>
          {"{val / 100} => 123.45"}
        </Text>
      </Row>
      <Spacer y={1} />
      <Row align="center">
        <LuChevronRight />
        <Spacer x={0.5} />
        <Text>
          {"$ {val / 100} => $ 123.45"}
        </Text>
      </Row>
      <Spacer y={1} />
      <Row align="center">
        <LuChevronRight />
        <Spacer x={0.5} />
        <Text>
          {"{val / 100} USD => 123.45 USD"}
        </Text>
      </Row>
    </div>
  );
}

const styles = {
  addConditionBtn: {
    boxShadow: "none",
  },
  conditionRow: {
    paddingTop: 5,
    paddingBottom: 5,
  },
  connectionNotice: {
    color: blackTransparent(0.6),
  },
  formulaActions: {
    display: "flex",
    alignItems: "flex-end",
  },
  tableFields: {
    cursor: "pointer",
    fontSize: 12,
  },
  fieldLabels: {
    maxWidth: 150,
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    overflow: "hidden",
  },
  rowDisplay: {
    display: "flex",
    alignItems: "center",
  }
};

const mapStateToProps = (state) => ({
  datasetResponses: state.dataset.responses,
});
const mapDispatchToProps = (dispatch) => {
  return {
    runRequest: (projectId, chartId, datasetId) => {
      return dispatch(runRequestAction(projectId, chartId, datasetId));
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(DatasetData);
