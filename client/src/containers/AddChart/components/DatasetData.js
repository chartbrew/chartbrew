import React, {
  useState, useEffect, useCallback, useRef
} from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import { Calendar } from "react-date-range";
import uuid from "uuid/v4";
import _ from "lodash";
import { formatISO, format } from "date-fns";
import { enGB } from "date-fns/locale";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import update from "immutability-helper";
import {
  Button, Collapse, Container, Dropdown, Grid, Input, Link, Loading,
  Popover, Row, Spacer, Text, Tooltip, Divider, Badge, Switch,
} from "@nextui-org/react";
import { HiRefresh } from "react-icons/hi";
import { TbDragDrop } from "react-icons/tb";
import {
  CaretDown, CaretUp, ChevronRight, CloseSquare, Filter, Hide,
  InfoCircle, Plus, Setting, Show, TickSquare, Calendar as CalendarIcon, ChevronDownCircle,
} from "react-iconly";
import { FaMagic, FaRedo } from "react-icons/fa";

import { runRequest as runRequestAction } from "../../../actions/dataset";
import fieldFinder from "../../../modules/fieldFinder";
import {
  blackTransparent, negative, neutral, positive, primary, secondary
} from "../../../config/colors";
import autoFieldSelector from "../../../modules/autoFieldSelector";
import { operations, operators } from "../../../modules/filterOperations";
import DraggableLabel from "./DraggableLabel";

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
    dataset, requestResult, onUpdate, runRequest, match, chartType, onNoRequest, chartData,
    dataLoading,
  } = props;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [fieldOptions, setFieldOptions] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [formula, setFormula] = useState("");
  const [tableFields, setTableFields] = useState([]);
  const [isDragState, setIsDragState] = useState(false);
  const [tableColumns, setTableColumns] = useState([]);
  const [xFieldFilter, setXFieldFilter] = useState("");
  const [yFieldFilter, setYFieldFilter] = useState("");
  const [dateFieldFilter, setDateFieldFilter] = useState("");
  const [groupByFilter, setGroupByFilter] = useState("");

  const yFieldRef = useRef(null);
  const xFieldRef = useRef(null);
  const dateFieldRef = useRef(null);
  const groupByRef = useRef(null);

  // Update the content when there is some data to work with
  useEffect(() => {
    if (requestResult && requestResult.data) {
      const tempFieldOptions = [];
      const fieldsSchema = {};
      const updateObj = {};

      const fields = fieldFinder(requestResult.data);

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
                      : "neutral"
            },
          });
        }
        fieldsSchema[o.field] = o.type;
      });

      if (Object.keys(fieldsSchema).length > 0) updateObj.fieldsSchema = fieldsSchema;

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

    if (dataset.fieldsSchema) {
      const tempFieldOptions = [];
      Object.keys(dataset.fieldsSchema).forEach((key) => {
        const type = dataset.fieldsSchema[key];
        tempFieldOptions.push({
          key,
          text: key && key.replace("root[].", "").replace("root.", ""),
          value: key,
          type,
          label: {
            style: { width: 55, textAlign: "center" },
            content: type || "unknown",
            size: "mini",
            color: type === "date" ? "secondary"
              : type === "number" ? "primary"
                : type === "string" ? "success"
                  : type === "boolean" ? "warning"
                    : "neutral"
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

  const _onAddFormula = () => {
    setFormula("{val}");
  };

  const _onExampleFormula = () => {
    setFormula("${val / 100}"); // eslint-disable-line
    onUpdate({ formula: "${val / 100}" }); // eslint-disable-line
  };

  const _onRemoveFormula = () => {
    setFormula("");
    onUpdate({ formula: "" });
  };

  const _onApplyFormula = () => {
    onUpdate({ formula });
  };

  const _onRefreshData = () => {
    setLoading(true);
    return runRequest(match.params.projectId, match.params.chartId, dataset.id)
      .then(() => {
        setLoading(false);
      })
      .catch((err) => {
        if (err.statusCode === 404) {
          setError("Click on 'Make request' to create a new configuration first.");
          onNoRequest();
        } else {
          setError(err.statusText || err);
        }
        setLoading(false);
      });
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

  const _getGroupByFields = () => {
    const filtered = fieldOptions.filter((f) => {
      if (f.type !== "object" && f.type !== "array") {
        if (f.key.replace("root[].", "").indexOf(".") === -1) return true;
      }

      return false;
    });

    if (!groupByFilter) return filtered;

    return filtered
      .filter((o) => o.text?.toString().toLowerCase().includes(groupByFilter.toLowerCase()));
  };

  const _onChangeGroupBy = (e, key) => {
    onUpdate({ groupBy: key || null });
    setGroupByFilter("");
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

  if ((!fieldOptions || !dataset.fieldsSchema) && dataset.connection_id) {
    return (
      <Container>
        <Row>
          <Button
            ghost
            iconRight={<HiRefresh />}
            onClick={_onRefreshData}
            disabled={loading}
            auto
          >
            {loading ? <Loading type="points" /> : "Fetch the data"}
          </Button>
        </Row>
        <Spacer y={1} />
        {error && (
          <Row>
            <Text i css={{ color: "$error" }}>{error}</Text>
          </Row>
        )}
      </Container>
    );
  }

  if (!dataset.connection_id) {
    return (
      <Container>
        <Row>
          <Text h4 style={styles.connectionNotice}>
            <span>{"Connect your dataset and fetch some data above."}</span>
          </Text>
        </Row>
      </Container>
    );
  }

  return (
    <Grid.Container gap={1}>
      <Grid xs={12} sm={6} md={6} className="datasetdata-axes-tut" direction="column">
        <div>
          <Text size={14} b>
            {chartType === "pie"
              || chartType === "radar"
              || chartType === "polar"
              || chartType === "doughnut"
              ? "Segment "
              : chartType === "table" ? "Collection " : "X-Axis "}
          </Text>
        </div>
        <div style={styles.rowDisplay}>
          <Dropdown>
            <Dropdown.Trigger type="text">
              <Input
                type="text"
                value={
                  xFieldFilter
                  || dataset.xAxis?.substring(dataset.xAxis.lastIndexOf(".") + 1)
                }
                onChange={(e) => setXFieldFilter(e.target.value)}
                fullWidth
                placeholder="Double-click to search"
                ref={xFieldRef}
                contentRight={document.activeElement === xFieldRef.current ? "↵" : null}
              />
            </Dropdown.Trigger>
            <Dropdown.Menu
              onAction={_selectXField}
              selectedKeys={[dataset.xAxis]}
              selectionMode="single"
              css={{ minWidth: "max-content" }}
            >
              {_filterOptions("x").map((option) => (
                <Dropdown.Item key={option.value} icon={<Badge isSquared size="xs" color={option.label.color}>{option.label.content}</Badge>}>
                  <Text>{option.text}</Text>
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
          {chartType === "table" && (
            <>
              <Spacer x={0.2} />
              <Tooltip
                content="Select a collection (array) of objects to display in a table format. 'Root' means the first level of the collection."
              >
                <InfoCircle />
              </Tooltip>
            </>
          )}
        </div>
      </Grid>
      <Grid xs={12} sm={6} md={6} className="datasetdata-date-tut" direction="column">
        <div>
          <Text size={14}>{"Select a date for global filtering"}</Text>
        </div>
        <div style={{ flexDirection: "row", display: "flex", alignItems: "center" }}>
          <Dropdown>
            <Dropdown.Trigger type="text">
              <Input
                type="text"
                value={
                  dateFieldFilter
                  || dataset.dateField?.substring(dataset.dateField.lastIndexOf(".") + 1)
                }
                fullWidth
                placeholder="Double-click to search"
                onChange={(e) => setDateFieldFilter(e.target.value)}
                ref={dateFieldRef}
                contentRight={document.activeElement === dateFieldRef.current ? "↵" : null}
              />
            </Dropdown.Trigger>
            <Dropdown.Menu
              onAction={_selectDateField}
              selectedKeys={[dataset.dateField]}
              selectionMode="single"
              css={{ minWidth: "max-content" }}
            >
              {_getDateFieldOptions().map((option) => (
                <Dropdown.Item
                  key={option.value}
                  icon={<Badge size="xs" isSquared color={option.label.color}>{option.label.content}</Badge>}
                >
                  <Text>{option.text}</Text>
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
          <Spacer x={0.2} />
          {dataset.dateField && (
            <Tooltip content="Clear field">
              <Link onClick={() => onUpdate({ dateField: "" })} css={{ color: "$error" }}>
                <CloseSquare />
              </Link>
            </Tooltip>
          )}
        </div>
      </Grid>
      {chartType !== "table" && (
        <>
          <Grid xs={12} sm={6} md={6} direction="column">
            <div>
              <Text size={14} b>
                {chartType === "pie"
                  || chartType === "radar"
                  || chartType === "polar"
                  || chartType === "doughnut"
                  ? "Data " : "Y-Axis "}
              </Text>
            </div>
            <div>
              <Dropdown>
                <Dropdown.Trigger type="text">
                  <Input
                    type="text"
                    value={
                      yFieldFilter
                      || dataset.yAxis?.substring(dataset.yAxis.lastIndexOf(".") + 1)
                    }
                    fullWidth
                    placeholder="Double-click to search"
                    onChange={(e) => setYFieldFilter(e.target.value)}
                    ref={yFieldRef}
                    contentRight={document.activeElement === yFieldRef.current ? "↵" : null}
                  />
                </Dropdown.Trigger>
                <Dropdown.Menu
                  onAction={_selectYField}
                  selectedKeys={[dataset.yAxis]}
                  selectionMode="single"
                  css={{ minWidth: "max-content" }}
                >
                  {_getYFieldOptions().map((option) => (
                    <Dropdown.Item key={option.value}>
                      <Container css={{ p: 0, m: 0 }}>
                        <Row>
                          <Badge size="sm" color={option.label.color}>{option.label.content}</Badge>
                          <Spacer x={0.2} />
                          <Text>{option.text}</Text>
                        </Row>
                      </Container>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
              <Spacer x={0.2} />
              <Dropdown
                icon={null}
                button
                className="small button"
                options={operations}
                search
                text={
                  (dataset.yAxisOperation
                    && operations.find((i) => i.value === dataset.yAxisOperation).text
                  )
                  || "Operation"
                }
                value={dataset.yAxisOperation}
                onChange={_selectYOp}
                scrolling
              >
                <Dropdown.Trigger>
                  <Input
                    value={
                      (dataset.yAxisOperation
                        && operations.find((i) => i.value === dataset.yAxisOperation).text
                      )
                      || "Operation"
                    }
                    fullWidth
                  />
                </Dropdown.Trigger>
                <Dropdown.Menu
                  onAction={_selectYOp}
                  selectedKeys={[dataset.yAxisOperation]}
                  selectionMode="single"
                  css={{ minWidth: "max-content" }}
                >
                  {operations.map((option) => (
                    <Dropdown.Item key={option.value}>
                      {option.text}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </div>
          </Grid>
          <Grid xs={12} sm={6} md={6} direction="column">
            <div>
              <Text size={14}>Sort on Y-Axis</Text>
            </div>
            <div style={styles.rowDisplay}>
              <Tooltip content="Sort the dataset in ascending order">
                <Button
                  color={dataset.sort === "asc" ? "secondary" : "primary"}
                  bordered={dataset.sort !== "asc"}
                  onClick={() => {
                    if (dataset.sort === "asc") {
                      onUpdate({ sort: "" });
                    } else {
                      onUpdate({ sort: "asc" });
                    }
                  }}
                  css={{ minWidth: "fit-content" }}
                  icon={<CaretUp />}
                />
              </Tooltip>
              <Spacer x={0.2} />
              <Tooltip content="Sort the dataset in descending order">
                <Button
                  color={dataset.sort === "desc" ? "secondary" : "primary"}
                  bordered={dataset.sort !== "desc"}
                  onClick={() => {
                    if (dataset.sort === "desc") {
                      onUpdate({ sort: "" });
                    } else {
                      onUpdate({ sort: "desc" });
                    }
                  }}
                  css={{ minWidth: "fit-content" }}
                  icon={<CaretDown />}
                />
              </Tooltip>
              {dataset.sort && (
                <>
                  <Spacer x={0.2} />
                  <Tooltip content="Clear sorting">
                    <Link css={{ color: "$error" }} onClick={() => onUpdate({ sort: "" })}>
                      <CloseSquare />
                    </Link>
                  </Tooltip>
                </>
              )}
            </div>
            <Spacer y={0.5} />
            {dataset.yAxisOperation === "avg" && (
              <div>
                <Text size={14}>Average by the total items on the chart</Text>
                <Switch
                  size="sm"
                  checked={dataset.averageByTotal}
                  onChange={() => onUpdate({ averageByTotal: !dataset.averageByTotal })}
                />
              </div>
            )}
          </Grid>
          <Grid xs={12} css={{ mt: 10 }}>
            {!formula && (
              <Link onClick={_onAddFormula} css={{ ai: "center", color: "$text" }}>
                <Plus />
                <Spacer x={0.2} />
                <Text b>Add Y-Axis formula</Text>
              </Link>
            )}
          </Grid>
        </>
      )}
      {formula && (
        <Grid xs={12} direction="column">
          <div>
            <Popover>
              <Popover.Trigger>
                <div style={styles.rowDisplay}>
                  <Text size={16}>
                    {"Formula "}
                  </Text>
                  <Spacer x={0.2} />
                  <InfoCircle size="small" />
                </div>
              </Popover.Trigger>
              <Popover.Content>
                <FormulaTips />
              </Popover.Content>
            </Popover>
          </div>
          <div style={styles.rowDisplay}>
            <Input
              placeholder="Enter your formula here: {val}"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              bordered
            />
            <Spacer x={0.5} />
            <Tooltip
              content={formula === dataset.formula ? "The formula is already applied" : "Apply the formula"}
            >
              <Link onClick={formula === dataset.formula ? () => { } : _onApplyFormula}>
                <TickSquare primaryColor={formula === dataset.formula ? neutral : positive} />
              </Link>
            </Tooltip>
            <Spacer x={0.2} />
            <Tooltip content="Remove formula">
              <Link onClick={_onRemoveFormula}>
                <CloseSquare primaryColor={negative} />
              </Link>
            </Tooltip>
            <Spacer x={0.5} />
            <Tooltip content="Click for an example">
              <Link onClick={_onExampleFormula}>
                <FaMagic size={18} color={primary} />
              </Link>
            </Tooltip>
          </div>
        </Grid>
      )}
      {chartType === "table" && (
        <>
          <Grid xs={12} css={{ pt: 20, pb: 20 }}>
            <Collapse.Group css={{ width: "100%", fs: 16, fontWeight: "$bold" }} bordered>
              <Collapse subtitle="Configure columns" css={{ color: "$text" }} arrowIcon={<Setting />}>
                <Container css={{ pl: 0, pr: 0 }}>
                  {!isDragState && (
                    <Row wrap="wrap">
                      {tableFields.map((field) => {
                        if (!field || !field.accessor || field.Header.indexOf("__cb_group") > -1) return (<span />);
                        return (
                          <Badge
                            color="primary"
                            css={{
                              border: dataset?.configuration?.sum === field.accessor
                                ? "solid 2px $secondary"
                                : "solid 2px $border",
                              mr: 3,
                            }}
                            style={{ marginBottom: 3 }}
                          >
                            <Link
                              css={{ ai: "center" }}
                              onClick={() => _onExcludeField(field.accessor)}
                              title="Hide field"
                            >
                              <Show primaryColor="white" />
                            </Link>
                            <Spacer x={0.2} />
                            {`${field.accessor.replace("?", ".")}`}
                            <Spacer x={0.2} />
                            <Dropdown>
                              <Dropdown.Trigger>
                                <Link
                                  css={{ ai: "center" }}
                                  title="Sum values on this field"
                                >
                                  <ChevronDownCircle primaryColor="white" />
                                </Link>
                              </Dropdown.Trigger>
                              <Dropdown.Menu>
                                <Dropdown.Item>
                                  <Link css={{ width: "100%" }} onClick={() => _onSumField(field.accessor)}>
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
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown>
                          </Badge>
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
                        <Spacer y={0.5} />
                      )}

                  <Row wrap="wrap" align="center">
                    {!isDragState
                      && dataset.excludedFields
                      && dataset.excludedFields.map((field) => (
                        <Badge
                          key={field}
                          onClick={() => _onShowField(field)}
                          color="warning"
                        >
                          <Link css={{ ai: "center" }}>
                            <Hide primaryColor="white" />
                          </Link>
                          <Spacer x={0.1} />
                          {field.replace("?", ".")}
                        </Badge>
                      ))}
                  </Row>
                  <Spacer y={1} />
                  <Row>
                    <Button
                      color={isDragState ? "success" : "primary"}
                      bordered
                      onClick={isDragState ? _onConfirmColumnOrder : _onDragStateClicked}
                      disabled={dataLoading}
                      auto
                      size="sm"
                      icon={<TbDragDrop size={20} />}
                    >
                      {isDragState && !dataLoading ? "Confirm ordering" : "Reorder columns"}
                      {dataLoading && <Loading type="points" />}
                    </Button>
                    {isDragState && (
                      <>
                        <Spacer x={0.2} />
                        <Button
                          icon={<CloseSquare />}
                          flat
                          color={"error"}
                          onClick={_onCancelColumnOrder}
                          title="Cancel ordering"
                          css={{ minWidth: "fit-content" }}
                          size="sm"
                        />
                      </>
                    )}
                  </Row>
                </Container>
              </Collapse>
            </Collapse.Group>
          </Grid>
          <Grid xs={12} direction="column">
            <div>
              <Text size={14}>{"Group by"}</Text>
            </div>
            <div style={styles.rowDisplay}>
              <Dropdown>
                <Dropdown.Trigger type="text">
                  <Input
                    type="text"
                    value={
                      groupByFilter
                      || dataset.groupBy
                      || ""
                    }
                    placeholder="Double-click to search"
                    onChange={(e) => setGroupByFilter(e.target.value)}
                    ref={groupByRef}
                    contentRight={document.activeElement === groupByRef.current ? "↵" : null}
                  />
                </Dropdown.Trigger>
                <Dropdown.Menu
                  onAction={(key) => {
                    if (key !== "$.0") _onChangeGroupBy(null, key);
                  }}
                  selectedKeys={[dataset.groupBy]}
                  selectionMode="single"
                  css={{ minWidth: "max-content" }}
                >
                  {_getGroupByFields().map((field) => (
                    <Dropdown.Item
                      key={field.value}
                      icon={<Badge size="xs" isSquared color={field.label.color}>{field.label.content}</Badge>}
                    >
                      <Text>{field.text}</Text>
                    </Dropdown.Item>
                  ))}
                  {_getGroupByFields().length === 0 && (
                    <Dropdown.Item>
                      <Text>No fields available</Text>
                    </Dropdown.Item>
                  )}
                </Dropdown.Menu>
              </Dropdown>
              <Spacer x={0.2} />
              <Tooltip content="Clear the grouping">
                <Link
                  color="error"
                  onClick={_onChangeGroupBy}
                >
                  <CloseSquare />
                </Link>
              </Tooltip>
            </div>
          </Grid>
        </>
      )}
      <Grid xs={12} direction="column">
        <Spacer y={1} />
        <Divider />
        <Spacer y={1} />
      </Grid>
      {conditions && conditions.length === 0 && (
        <Grid xs={12} className="datasetdata-filters-tut">
          <Button
            bordered
            icon={<Filter />}
            onClick={_onAddCondition}
            auto
            size={"sm"}
          >
            Add data filters
          </Button>
        </Grid>
      )}
      {conditions.map((condition, index) => {
        return (
          <Grid xs={12} key={condition.id} style={styles.conditionRow} className="datasetdata-filters-tut">
            <Container css={{ pl: 0, pr: 0 }}>
              <Row warp="wrap" gap={0.5} align="center" css={{ ml: 0, mr: 0 }}>
                {index === 0 && (<Text size={14}>{"where "}</Text>)}
                {index > 0 && (<Text size={14}>{"and "}</Text>)}
                <Spacer x={0.2} />
                <Dropdown>
                  <Dropdown.Trigger>
                    <Input
                      value={(condition.field && condition.field.substring(condition.field.lastIndexOf(".") + 1)) || "field"}
                      size="sm"
                    />
                  </Dropdown.Trigger>
                  <Dropdown.Menu
                    onAction={(key) => _updateCondition(condition.id, key, "field")}
                    selectedKeys={[condition.field]}
                    selectionMode="single"
                    css={{ minWidth: "max-content" }}
                  >
                    {fieldOptions.map((field) => (
                      <Dropdown.Item key={field.value}>
                        <Container css={{ p: 0, m: 0 }}>
                          <Row>
                            <Badge size="sm" color={field.label.color}>{field.label.content}</Badge>
                            <Spacer x={0.2} />
                            <Text>{field.text}</Text>
                          </Row>
                        </Container>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
                <Spacer x={0.2} />
                <Dropdown>
                  <Dropdown.Trigger>
                    <Input
                      value={
                        (
                          _.find(operators, { value: condition.operator })
                          && _.find(operators, { value: condition.operator }).key
                        )
                        || "="
                      }
                      size="sm"
                    />
                  </Dropdown.Trigger>
                  <Dropdown.Menu
                    onAction={(key) => _updateCondition(condition.id, key, "operator")}
                    selectedKeys={[condition.operator]}
                    selectionMode="single"
                    css={{ minWidth: "max-content" }}
                  >
                    {operators.map((operator) => (
                      <Dropdown.Item key={operator.value}>
                        {operator.text}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
                <Spacer x={0.2} />
                <div>
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
                      <Popover.Trigger>
                        <Input
                          contentRight={<CalendarIcon />}
                          value={(condition.value && format(new Date(condition.value), "Pp", { locale: enGB })) || "Enter a value"}
                          disabled={(condition.operator === "isNotNull" || condition.operator === "isNull")}
                          size="sm"
                        />
                      </Popover.Trigger>
                      <Popover.Content>
                        <Calendar
                          date={(condition.value && new Date(condition.value)) || new Date()}
                          onChange={(date) => _updateCondition(condition.id, formatISO(date), "value", _.find(fieldOptions, { value: condition.field }).type)}
                          locale={enGB}
                          color={secondary}
                        />
                      </Popover.Content>
                    </Popover>
                  )}
                </div>
                <Spacer x={0.2} />
                <Tooltip content="Remove condition">
                  <Link color="error" onClick={() => _onRemoveCondition(condition.id)}>
                    <CloseSquare />
                  </Link>
                </Tooltip>

                {index === conditions.length - 1 && (
                  <Tooltip content="Add a new condition">
                    <Link color="primary" onClick={_onAddCondition}>
                      <Plus />
                    </Link>
                  </Tooltip>
                )}

                {condition.field && condition.operator && !condition.exposed && (
                  <Tooltip content="Expose filter to viewers" color={"invert"}>
                    <Link
                      color="secondary"
                      onClick={() => _onApplyCondition(
                        condition.id,
                        true,
                        _.find(fieldOptions, { value: condition.field })
                          && _.find(fieldOptions, { value: condition.field }).type
                      )}
                    >
                      <Show />
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
                      <Hide />
                    </Link>
                  </Tooltip>
                )}

                {!condition.saved && condition.field && (
                  <Tooltip content="Apply this condition">
                    <Link
                      color="success"
                      onClick={() => _onApplyCondition(condition.id, condition.exposed)}
                    >
                      <TickSquare />
                    </Link>
                  </Tooltip>
                )}
                <Spacer x={0.2} />
                {!condition.saved && condition.value && (
                  <Tooltip content="Undo changes">
                    <Link
                      color="warning"
                      onClick={() => _onRevertCondition(condition.id)}
                    >
                      <FaRedo size={18} />
                    </Link>
                  </Tooltip>
                )}
              </Row>
            </Container>
          </Grid>
        );
      })}
      {conditions.filter((c) => c.exposed).length > 0 && (
        <Grid xs={12} direction="column">
          <div><Text>{"Exposed filters on the chart"}</Text></div>
          <Spacer y={0.2} />
          <div>
            {conditions.filter((c) => c.exposed).map((condition) => {
              return (
                <Badge key={condition.id} color={"primary"} size="sm">
                  {condition.field.replace("root[].", "")}
                  <Spacer x={0.2} />
                  <Link onClick={() => _onHideCondition(condition.id)} color="error">
                    <CloseSquare size="small" color="white" />
                  </Link>
                </Badge>
              );
            })}
          </div>
        </Grid>
      )}
    </Grid.Container>
  );
}

DatasetData.defaultProps = {
  requestResult: null,
  chartType: "",
  chartData: null,
  dataLoading: false,
};

DatasetData.propTypes = {
  dataset: PropTypes.object.isRequired,
  requestResult: PropTypes.object,
  chartType: PropTypes.string,
  chartData: PropTypes.object,
  onUpdate: PropTypes.func.isRequired,
  runRequest: PropTypes.func.isRequired,
  onNoRequest: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  dataLoading: PropTypes.bool,
};

function FormulaTips() {
  return (
    <Container css={{ p: 10 }}>
      <Row>
        <Text b>{"Formulas allow you to manipulate the final results on the Y-Axis"}</Text>
      </Row>
      <Spacer y={0.5} />
      <Row>
        <Text>{"For"}</Text>
        <Spacer x={0.2} />
        <Text b>{"val = 12345"}</Text>
      </Row>
      <Spacer y={0.5} />
      <Row align="center">
        <ChevronRight />
        <Spacer x={0.2} />
        <Text>
          {"{val} => 12345"}
        </Text>
      </Row>
      <Spacer y={0.5} />
      <Row align="center">
        <ChevronRight />
        <Spacer x={0.2} />
        <Text>
          {"{val / 100} => 123.45"}
        </Text>
      </Row>
      <Spacer y={0.5} />
      <Row align="center">
        <ChevronRight />
        <Spacer x={0.2} />
        <Text>
          {"$ {val / 100} => $ 123.45"}
        </Text>
      </Row>
      <Spacer y={0.5} />
      <Row align="center">
        <ChevronRight />
        <Spacer x={0.2} />
        <Text>
          {"{val / 100} USD => 123.45 USD"}
        </Text>
      </Row>
    </Container>
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

const mapStateToProps = () => ({});
const mapDispatchToProps = (dispatch) => {
  return {
    runRequest: (projectId, chartId, datasetId) => {
      return dispatch(runRequestAction(projectId, chartId, datasetId));
    },
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(DatasetData));
