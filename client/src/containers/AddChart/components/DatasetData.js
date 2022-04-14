import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Dropdown, Icon, Input, Button, Grid, Popup, Divider,
  Header, Container, Form, List, Label, Transition,
} from "semantic-ui-react";
import { Calendar } from "react-date-range";
import uuid from "uuid/v4";
import _ from "lodash";
import { formatISO, format } from "date-fns";
import { enGB } from "date-fns/locale";

import { runRequest as runRequestAction } from "../../../actions/dataset";
import fieldFinder from "../../../modules/fieldFinder";
import { blackTransparent, secondary } from "../../../config/colors";
import autoFieldSelector from "../../../modules/autoFieldSelector";
import { operations, operators } from "../../../modules/filterOperations";

function DatasetData(props) {
  const {
    dataset, requestResult, onUpdate, runRequest, match, chartType, onNoRequest, chartData,
  } = props;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [fieldOptions, setFieldOptions] = useState([]);
  const [conditions, setConditions] = useState([{
    id: uuid(),
    field: "",
    operator: "is",
    value: "",
  }]);
  const [formula, setFormula] = useState("");
  const [tableFields, setTableFields] = useState([]);
  const [showTableFields, setShowTableFields] = useState(true);
  const [selectedField, setSelectedField] = useState("");

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
              color: o.type === "date" ? "olive"
                : o.type === "number" ? "blue"
                  : o.type === "string" ? "teal"
                    : o.type === "boolean" ? "purple"
                      : "grey"
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
            color: type === "date" ? "olive"
              : type === "number" ? "blue"
                : type === "string" ? "teal"
                  : type === "boolean" ? "purple"
                    : "grey"
          },
        });
      });

      setFieldOptions(tempFieldOptions);
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

  const _selectXField = (e, data) => {
    onUpdate({ xAxis: data.value });
  };

  const _selectYField = (e, data) => {
    onUpdate({ yAxis: data.value });
  };

  const _selectYOp = (e, data) => {
    onUpdate({ yAxisOperation: data.value });
  };

  const _selectDateField = (e, data) => {
    onUpdate({ dateField: data.value });
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

    if (newConditions.length === 0) {
      newConditions.push({
        id: uuid(),
        field: "",
        operator: "is",
        value: "",
        saved: false,
      });
    }

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
    setTimeout(() => setSelectedField(""));
    onUpdate({ excludedFields: newExcludedFields });
  };

  const _onShowField = (field) => {
    const excludedFields = dataset.excludedFields || [];
    const index = _.indexOf(excludedFields, field);
    excludedFields.splice(index, 1);
    onUpdate({ excludedFields });
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

  const _onSelectField = (field) => {
    if (selectedField === field.accessor) {
      setSelectedField("");
    } else if (selectedField && selectedField !== field.accessor) {
      const groups = dataset.groups || [];
      groups.push({ key: selectedField.replace("?", "."), value: field.accessor.replace("?", ".") });
      onUpdate({ groups });
      setSelectedField("");
    } else {
      setSelectedField(field.accessor);
    }
  };

  const _onGroupFields = (e, data) => {
    const groups = dataset.groups || [];
    groups.push(
      { key: selectedField.replace("?", "."), value: data.value.substring(data.value.lastIndexOf("].") + 2) }
    );
    onUpdate({ groups });
    setSelectedField("");
  };

  const _onRemoveGroup = (key) => {
    const newGroups = [...dataset.groups];
    const removeIndex = _.findIndex(newGroups, { key });
    newGroups.splice(removeIndex, 1);
    onUpdate({ groups: newGroups });
  };

  if ((!fieldOptions || !dataset.fieldsSchema) && dataset.connection_id) {
    return (
      <Container textAlign="center">
        <Button
          basic
          color="blue"
          icon
          labelPosition="right"
          onClick={_onRefreshData}
          loading={loading}
        >
          <Icon name="refresh" />
          Fetch the data
        </Button>
        {error && (
          <p>
            <br />
            <i>{error}</i>
          </p>
        )}
      </Container>
    );
  }

  const _getGroupByFields = () => {
    return fieldOptions.filter((f) => {
      if (f.type !== "object" && f.type !== "array") {
        if (f.key.replace("root[].", "").indexOf(".") === -1) return true;
      }

      return false;
    });
  };

  const _onChangeGroupBy = (e, data) => {
    onUpdate({ groupBy: data.value });
  };

  if (!dataset.connection_id) {
    return (
      <Container textAlign="center">
        <Header icon size="small" style={styles.connectionNotice}>
          <Icon name="plug" />
          <span>{" Connect your dataset and fetch some data."}</span>
        </Header>
      </Container>
    );
  }

  return (
    <Grid style={styles.mainGrid} centered stackable>
      <Grid.Row columns={1} className="datasetdata-axes-tut">
        <Grid.Column>
          <label>
            <strong>
              {chartType === "pie"
                || chartType === "radar"
                || chartType === "polar"
                || chartType === "doughnut"
                ? "Segment "
                : chartType === "table" ? "Collection " : "X Axis "}
            </strong>
          </label>
          <Dropdown
            icon={null}
            header="Type to search"
            button
            className="small button"
            options={_filterOptions("x")}
            search
            text={(dataset.xAxis && dataset.xAxis.substring(dataset.xAxis.lastIndexOf(".") + 1)) || "Select a field"}
            value={dataset.xAxis}
            onChange={_selectXField}
            scrolling
          />
          {chartType === "table" && (
            <Popup
              trigger={<Icon name="question circle outline" />}
              content="Select a collection (array) of objects to display in a table format. 'Root' means the first level of the collection."
            />
          )}
        </Grid.Column>
      </Grid.Row>
      {chartType !== "table" && (
        <Grid.Row columns={1}>
          <Grid.Column>
            <label>
              <strong>
                {chartType === "pie"
                  || chartType === "radar"
                  || chartType === "polar"
                  || chartType === "doughnut"
                  ? "Data " : "Y Axis "}
              </strong>
            </label>
            <Dropdown
              icon={null}
              header="Type to search"
              button
              className="small button"
              options={fieldOptions}
              search
              text={(dataset.yAxis && dataset.yAxis.substring(dataset.yAxis.lastIndexOf(".") + 1)) || "Select a field"}
              value={dataset.yAxis}
              onChange={_selectYField}
              scrolling
            />
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
            />

            <>
              <Popup
                trigger={(
                  <Button
                    icon="sort content ascending"
                    basic
                    primary={dataset.sort === "asc"}
                    onClick={() => {
                      if (dataset.sort === "asc") {
                        onUpdate({ sort: "" });
                      } else {
                        onUpdate({ sort: "asc" });
                      }
                    }}
                  />
                )}
                content="Sort the dataset in ascending order"
                inverted
              />
              <Popup
                trigger={(
                  <Button
                    icon="sort content descending"
                    basic
                    primary={dataset.sort === "desc"}
                    onClick={() => {
                      if (dataset.sort === "desc") {
                        onUpdate({ sort: "" });
                      } else {
                        onUpdate({ sort: "desc" });
                      }
                    }}
                  />
                )}
                content="Sort the dataset in descending order"
                inverted
              />
            </>
            {dataset.sort && (
              <Popup
                trigger={(
                  <Button
                    className="tertiary"
                    icon="x"
                    onClick={() => onUpdate({ sort: "" })}
                  />
                )}
                content="Clear sorting"
                inverted
              />
            )}

            {!formula && (
              <div>
                <Button
                  icon
                  className="tertiary"
                  onClick={_onAddFormula}
                  size="small"
                >
                  <Icon name="plus" />
                  {" Add formula"}
                </Button>
              </div>
            )}
          </Grid.Column>
        </Grid.Row>
      )}
      {formula && (
        <Grid.Row>
          <Grid.Column>
            <Form>
              <Form.Group>
                <Form.Field>
                  <Popup
                    trigger={(
                      <label>
                        {"Formula "}
                        <Icon name="question circle outline" />
                      </label>
                    )}
                    content={<FormulaTips />}
                    wide
                  />
                  <Form.Input
                    placeholder="Enter your formula here: {val}"
                    value={formula}
                    onChange={(e, data) => setFormula(data.value)}
                  />
                </Form.Field>
                <Form.Field style={styles.formulaActions}>
                  <Popup
                    trigger={(
                      <Button
                        icon
                        basic
                        style={styles.addConditionBtn}
                        onClick={formula === dataset.formula ? () => { } : _onApplyFormula}
                      >
                        <Icon name="checkmark" color={formula === dataset.formula ? null : "green"} />
                      </Button>
                    )}
                    content={formula === dataset.formula ? "The formula is already applied" : "Apply the formula"}
                    position="top center"
                  />
                  <Popup
                    trigger={(
                      <Button
                        icon
                        basic
                        style={styles.addConditionBtn}
                        onClick={_onRemoveFormula}
                      >
                        <Icon name="minus" color="red" />
                      </Button>
                    )}
                    content="Remove formula"
                    position="top center"
                  />
                  <Popup
                    trigger={(
                      <Button
                        icon
                        basic
                        style={styles.addConditionBtn}
                        onClick={_onExampleFormula}
                      >
                        <Icon name="magic" />
                      </Button>
                    )}
                    content="Click for an example"
                    position="top center"
                  />
                </Form.Field>
              </Form.Group>
            </Form>
          </Grid.Column>
        </Grid.Row>
      )}
      {chartType === "table" && (
        <Grid.Row>
          <Grid.Column>
            {!selectedField && (
              <Header as="h4" onClick={() => setShowTableFields(!showTableFields)} style={styles.tableFields}>
                {"Configure visible columns "}
                {!showTableFields && (<Icon size="small" name="chevron down" />)}
                {showTableFields && (<Icon size="small" name="chevron up" />)}
              </Header>
            )}
            {selectedField && (
              <Header as="h4">
                Now click on another field to combine them
              </Header>
            )}
            <Transition animation="fade down" visible={showTableFields}>
              <div>
                <Label.Group>
                  {tableFields.map((field) => {
                    if (!field || !field.accessor || field.Header.indexOf("__cb_group") > -1) return (<span />);
                    return (
                      <Label
                        color={selectedField === field.accessor ? "olive" : "violet"}
                        key={field.accessor}
                        as="a"
                        onClick={() => _onSelectField(field)}
                        style={
                          selectedField && selectedField !== field.accessor
                            ? { ...styles.pulsating, ...styles.fieldLabels } : styles.fieldLabels
                        }
                        title={field.accessor.replace("?", ".")}
                      >
                        {!selectedField && (<Icon name="eye" onClick={() => _onExcludeField(field.accessor)} />)}
                        {selectedField && selectedField !== field.accessor && (
                          <Icon name="code branch" />
                        )}
                        {`${field.accessor.replace("?", ".")}  `}
                      </Label>
                    );
                  })}
                </Label.Group>

                {selectedField && (
                  <Form>
                    <Form.Field>
                      <label>Or select a specific field</label>
                      <Dropdown
                        icon={null}
                        header="Type to search"
                        button
                        className="small button"
                        options={fieldOptions}
                        search
                        text={"Select a field"}
                        onChange={_onGroupFields}
                        scrolling
                      />
                    </Form.Field>
                  </Form>
                )}

                <Label.Group>
                  {dataset.excludedFields && dataset.excludedFields.map((field) => (
                    <Label
                      key={field}
                      basic
                      onClick={() => _onShowField(field)}
                      as="a"
                    >
                      <Icon name="eye slash outline" />
                      {field.replace("?", ".")}
                    </Label>
                  ))}
                </Label.Group>

                {dataset.groups && dataset.groups.length > 0 && (
                  <>
                    <Divider />
                    {dataset.groups.map((group) => (
                      <div key={`${group.key}`}>
                        <Label>{group.key}</Label>
                        <span>{" - "}</span>
                        <Label>{group.value}</Label>
                        <Popup
                          trigger={(
                            <Button
                              icon="x"
                              basic
                              style={styles.addConditionBtn}
                              onClick={() => _onRemoveGroup(group.key)}
                            />
                          )}
                          content="Remove combination"
                        />
                      </div>
                    ))}
                  </>
                )}
              </div>
            </Transition>

            <Header as="h4">
              Group final results by
            </Header>

            <Dropdown
              icon={null}
              header="Type to search"
              button
              className="small button"
              options={_getGroupByFields()}
              search
              text={dataset.groupBy || "Select a field"}
              onChange={_onChangeGroupBy}
              value={dataset.groupBy}
              scrolling
            />
            <Popup
              trigger={(
                <Button
                  icon="x"
                  basic
                  style={styles.addConditionBtn}
                  onClick={() => _onChangeGroupBy(null, { value: null })}
                />
              )}
              content="Clear the grouping"
            />
          </Grid.Column>
        </Grid.Row>
      )}
      {conditions.map((condition, index) => {
        return (
          <Grid.Row key={condition.id} style={styles.conditionRow} className="datasetdata-filters-tut">
            <Grid.Column>
              {index === 0 && chartType !== "table" && <Divider />}
              {index === 0 && chartType === "table" && (<Header as="h4">Filter the data</Header>)}
              {index === 0 && (<label>{"where "}</label>)}
              {index > 0 && (<label>{"and "}</label>)}
              <Dropdown
                icon={null}
                header="Type to search"
                className="small button"
                button
                options={fieldOptions}
                search
                text={(condition.field && condition.field.substring(condition.field.lastIndexOf(".") + 1)) || "field"}
                value={condition.field}
                onChange={(e, data) => _updateCondition(condition.id, data.value, "field")}
              />
              <Dropdown
                icon={null}
                button
                className="small button"
                options={operators}
                search
                text={
                  (
                    _.find(operators, { value: condition.operator })
                    && _.find(operators, { value: condition.operator }).key
                  )
                  || "="
                }
                value={condition.operator}
                onChange={(e, data) => _updateCondition(condition.id, data.value, "operator")}
              />

              {(!condition.field
                || (_.find(fieldOptions, { value: condition.field })
                && _.find(fieldOptions, { value: condition.field }).type !== "date")) && (
                <Input
                  placeholder="Enter a value"
                  size="small"
                  value={condition.value}
                  onChange={(e, data) => _updateCondition(condition.id, data.value, "value", _.find(fieldOptions, { value: condition.field }))}
                  disabled={(condition.operator === "isNotNull" || condition.operator === "isNull")}
                />
              )}
              {_.find(fieldOptions, { value: condition.field })
                && _.find(fieldOptions, { value: condition.field }).type === "date" && (
                <Popup
                  on="click"
                  pinned
                  position="top center"
                  trigger={(
                    <Input
                      placeholder="Enter a value"
                      icon="calendar alternate"
                      iconPosition="left"
                      size="small"
                      value={condition.value && format(new Date(condition.value), "Pp", { locale: enGB })}
                      disabled={(condition.operator === "isNotNull" || condition.operator === "isNull")}
                    />
                  )}
                  content={(
                    <Calendar
                      date={(condition.value && new Date(condition.value)) || new Date()}
                      onChange={(date) => _updateCondition(condition.id, formatISO(date), "value", _.find(fieldOptions, { value: condition.field }).type)}
                      locale={enGB}
                      color={secondary}
                    />
                  )}
                />
              )}

              <Button.Group size="small">
                <Popup
                  trigger={(
                    <Button
                      icon
                      basic
                      style={styles.addConditionBtn}
                      onClick={() => _onRemoveCondition(condition.id)}
                    >
                      <Icon name="minus" />
                    </Button>
                  )}
                  content="Remove condition"
                  position="top center"
                />

                {index === conditions.length - 1 && (
                  <Popup
                    trigger={(
                      <Button
                        icon
                        basic
                        style={styles.addConditionBtn}
                        onClick={_onAddCondition}
                      >
                        <Icon name="plus" />
                      </Button>
                    )}
                    content="Add a new condition"
                    position="top center"
                  />
                )}

                {condition.field && condition.operator && !condition.exposed && (
                  <Popup
                    trigger={(
                      <Button
                        icon
                        basic
                        style={styles.addConditionBtn}
                        onClick={() => _onApplyCondition(
                          condition.id,
                          true,
                          _.find(fieldOptions, { value: condition.field })
                            && _.find(fieldOptions, { value: condition.field }).type
                        )}
                      >
                        <Icon name="eye" />
                      </Button>
                    )}
                    content="Expose filter to viewers"
                    position="top center"
                  />
                )}

                {condition.field && condition.operator && condition.exposed && (
                  <Popup
                    trigger={(
                      <Button
                        icon
                        basic
                        style={styles.addConditionBtn}
                        onClick={() => _onApplyCondition(
                          condition.id,
                          false,
                          _.find(fieldOptions, { value: condition.field })
                          && _.find(fieldOptions, { value: condition.field }).type
                        )}
                      >
                        <Icon name="eye slash outline" />
                      </Button>
                    )}
                    content="Hide this filter from viewers"
                    position="top center"
                  />
                )}

                {!condition.saved && condition.field && (
                  <Popup
                    trigger={(
                      <Button
                        icon
                        basic
                        style={styles.addConditionBtn}
                        onClick={() => _onApplyCondition(condition.id, condition.exposed)}
                      >
                        <Icon name="checkmark" color="green" />
                      </Button>
                    )}
                    content="Apply this condition"
                    position="top center"
                  />
                )}

                {!condition.saved && condition.value && (
                  <Popup
                    trigger={(
                      <Button
                        icon
                        basic
                        style={styles.addConditionBtn}
                        onClick={() => _onRevertCondition(condition.id)}
                      >
                        <Icon name="undo alternate" color="olive" />
                      </Button>
                    )}
                    content="Undo changes"
                    position="top center"
                  />
                )}
              </Button.Group>
            </Grid.Column>

          </Grid.Row>
        );
      })}
      {conditions.filter((c) => c.exposed).length > 0 && (
        <Grid.Row>
          <Grid.Column>
            <p>{"Exposed filters on the chart"}</p>
            <Label.Group>
              {conditions.filter((c) => c.exposed).map((condition) => {
                return (
                  <Label key={condition.id}>
                    {condition.field.replace("root[].", "")}
                    <Icon
                      name="delete"
                      onClick={() => _onHideCondition(condition.id)}
                    />
                  </Label>
                );
              })}
            </Label.Group>
          </Grid.Column>
        </Grid.Row>
      )}
      <Grid.Row>
        <Grid.Column className="datasetdata-date-tut">
          <Divider hidden />
          <Header size="small" dividing>{"Select a date for global filtering (optional)"}</Header>
          <div>
            <Dropdown
              icon={null}
              header="Type to search"
              button
              className="small button"
              options={fieldOptions}
              search
              text={(dataset.dateField && dataset.dateField.substring(dataset.dateField.lastIndexOf(".") + 1)) || "Select a field"}
              value={dataset.dateField}
              onChange={_selectDateField}
              scrolling
            />
            {dataset.dateField && (
              <Popup
                trigger={(
                  <Button
                    icon
                    basic
                    onClick={() => onUpdate({ dateField: "" })}
                    size="small"
                  >
                    <Icon name="x" />
                  </Button>
                )}
                content="Clear field"
                position="top center"
              />
            )}
          </div>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
}

DatasetData.defaultProps = {
  requestResult: null,
  chartType: "",
  chartData: null,
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
};

function FormulaTips() {
  return (
    <div>
      <Header size="small">Formulas allow you to manipulate the final results on the Y Axis</Header>
      <p>
        {"For "}
        <strong>{"val = 12345"}</strong>
      </p>
      <List>
        <List.Item>
          <Icon name="chevron right" />
          <List.Content>
            <p>{"{val} => 12345"}</p>
          </List.Content>
        </List.Item>
        <List.Item>
          <Icon name="chevron right" />
          <List.Content>
            <p>{"{val / 100} => 123.45"}</p>
          </List.Content>
        </List.Item>
        <List.Item>
          <Icon name="chevron right" />
          <List.Content>
            <p>{"$ {val / 100} => $ 123.45"}</p>
          </List.Content>
        </List.Item>
        <List.Item>
          <Icon name="chevron right" />
          <List.Content>
            <p>{"{val / 100} USD => 123.45 USD"}</p>
          </List.Content>
        </List.Item>
      </List>
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
  },
  fieldLabels: {
    maxWidth: 150,
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    overflow: "hidden",
  },
  pulsating: {
    animation: "pulse 2s infinite",
  },
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
