import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch } from "react-redux";
import {
  Autocomplete, Button, Calendar, Card,
  Checkbox, Chip, DateField, DatePicker, Drawer,
  Dropdown, EmptyState, Input, Label, Link, ListBox,
  Modal, SearchField, Select, Separator,
  Switch, Tooltip, useFilter,
} from "@heroui/react";
import {
  LuCircleCheck, LuEye, LuEyeOff, LuListFilter, LuPlus, LuRedo,
  LuSettings, LuCircleX, LuChevronsRight,
} from "react-icons/lu";
import { find } from "lodash";
import { nanoid } from "@reduxjs/toolkit";
import { parseDate } from "@internationalized/date";
import { I18nProvider } from "@react-aria/i18n";
import toast from "react-hot-toast";

import Row from "./Row";
import { ButtonSpinner } from "./ButtonSpinner";
import { operators } from "../modules/filterOperations";
import { createDatasetVariableBinding, updateDatasetVariableBinding } from "../slices/dataset";

function DatasetFilters(props) {
  const { onUpdate, fieldOptions, dataset } = props;
  const { contains } = useFilter({ sensitivity: "base" });

  const [conditions, setConditions] = useState([]);
  const [selectedCondition, setSelectedCondition] = useState({});
  const [conditionModal, setConditionModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [variableSettings, setVariableSettings] = useState(null);
  const [variableLoading, setVariableLoading] = useState(false);
  const [localDataset, setLocalDataset] = useState(dataset);

  const dispatch = useDispatch();

  useEffect(() => {
    if (dataset.conditions) {
      setConditions(dataset.conditions);
    }
    setLocalDataset(dataset);
  }, [dataset]);

  const _updateCondition = (id, data, type, dataType) => {
    const newConditions = conditions.map((condition) => {
      const newCondition = { ...condition };
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
        const previousItem = find(dataset.conditions, { id });
        newItem = { ...previousItem };
      }

      return newItem;
    });

    setConditions(newConditions);
  };

  const _onAddCondition = () => {
    const newConditions = [...conditions, {
      id: nanoid(),
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

  const _onConfirmConditionSettings = async () => {
    const newConditions = conditions.map((item) => {
      let newItem = { ...item };
      if (item.id === selectedCondition.id) {
        newItem = { ...selectedCondition };
      }

      return newItem;
    });

    setIsLoading(true);
    await onUpdate({ conditions: newConditions });
    setIsLoading(false);
    setSelectedCondition({});
    setConditionModal(false);
  };

  const _isVariableValid = (val) => {
    const regex = /^[a-zA-Z_][a-zA-Z0-9_]{0,31}$/;
    if (regex.test(val)) {
      return true;
    }

    return false;
  };

  const _onVariableClick = (variable) => {
    let selectedVariable = localDataset.VariableBindings?.find((v) => v.name === variable.variable);
    if (selectedVariable) {
      setVariableSettings(selectedVariable);
    } else {
      setVariableSettings({
        name: variable.variable,
        type: "string",
        value: "",
      });
    }
  };

  const _onVariableSave = async () => {
    setVariableLoading(true);
    try {
      let response;
      if (variableSettings.id) {
        response = await dispatch(updateDatasetVariableBinding({
          team_id: localDataset.team_id,
          dataset_id: localDataset.id,
          variable_id: variableSettings.id,
          data: variableSettings,
        }));
      } else {
        response = await dispatch(createDatasetVariableBinding({
          team_id: localDataset.team_id,
          dataset_id: localDataset.id,
          data: variableSettings,
        }));
      }

      setVariableLoading(false);
      setVariableSettings(null);
      toast.success("Variable saved successfully");
      
      // Update the local dataset with the fresh data from the backend
      if (response.payload) {
        setLocalDataset(response.payload);
        // Also trigger onUpdate to let parent know dataset was modified
        await onUpdate({});
      }
    } catch (error) {
      setVariableLoading(false);
      toast.error("Failed to save variable");
    }
  };

  // Helper function to detect and render variables in input value
  const _renderValueWithVariables = (value) => {
    if (!value) return null;
    
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = variableRegex.exec(value)) !== null) {
      // Add text before the variable
      if (match.index > lastIndex) {
        parts.push(value.substring(lastIndex, match.index));
      }
      
      // Add the variable as a clickable chip
      parts.push({
        type: "variable",
        variable: match[1].trim(),
        placeholder: match[0]
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < value.length) {
      parts.push(value.substring(lastIndex));
    }
    
    return parts;
  };

  return (
    <div className="flex flex-col gap-2">
      {conditions && conditions.length === 0 && (
        <div className="datasetdata-filters-tut">
          <Button
            onPress={_onAddCondition}
            variant="tertiary"
            size="sm"
          >
            <LuListFilter />
            Add data filters
          </Button>
        </div>
      )}
      {conditions.map((condition, index) => {
        return (
          <Card key={condition.id} className="datasetdata-filters-tut shadow-none border-1 border-content3 border-solid rounded-lg">
            <Card.Header>
              {index === 0 && (<div className="text-sm">{"where "}</div>)}
              {index > 0 && (<div className="text-sm">{"and "}</div>)}
            </Card.Header>
            <Separator />
            <Card.Content>
              <Autocomplete
                placeholder="Field"
                selectionMode="single"
                value={condition.field || null}
                onChange={(value) => _updateCondition(condition.id, value, "field")}
                variant="secondary"
                size="sm"
                aria-label="Field"
              >
                <Autocomplete.Trigger>
                  <Autocomplete.Value />
                  <Autocomplete.ClearButton />
                  <Autocomplete.Indicator />
                </Autocomplete.Trigger>
                <Autocomplete.Popover>
                  <Autocomplete.Filter filter={contains}>
                    <SearchField autoFocus name={`field-search-${condition.id}`} variant="secondary">
                      <SearchField.Group>
                        <SearchField.SearchIcon />
                        <SearchField.Input placeholder="Search fields..." />
                        <SearchField.ClearButton />
                      </SearchField.Group>
                    </SearchField>
                    <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
                      {fieldOptions.filter((f) => !f.isObject).map((field) => (
                        <ListBox.Item
                          key={field.value}
                          id={field.value}
                          textValue={field.text}
                        >
                          <Chip size="sm" variant="soft" className={"min-w-[70px] text-center"} >{field.label.content}</Chip>
                          <span>{field.text}</span>
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Autocomplete.Filter>
                </Autocomplete.Popover>
              </Autocomplete>
              <div className="h-1" />
              <Row warp="wrap" className={"flex gap-2"} align="center">
                <Dropdown aria-label="Select an operator">
                  <Dropdown.Trigger>
                    <Input
                      value={
                        (
                          find(operators, { value: condition.operator })
                          && find(operators, { value: condition.operator }).key
                        )
                        || "="
                      }
                      labelPlacement="outside"
                      className="max-w-[100px]"
                      size="sm"
                    />
                  </Dropdown.Trigger>
                  <Dropdown.Popover>
                    <Dropdown.Menu
                      onSelectionChange={(keys) => _updateCondition(condition.id, keys.currentKey, "operator")}
                      selectedKeys={[condition.operator]}
                      selectionMode="single"
                    >
                      {operators.map((operator) => (
                        <Dropdown.Item id={operator.value} key={operator.value} textValue={operator.text}>
                          {operator.text}
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
                <div className="min-w-[150px] w-full">
                  {(!condition.field
                    || (find(fieldOptions, { value: condition.field })
                    && find(fieldOptions, { value: condition.field }).type !== "date")) && (
                      <Input
                        placeholder="Value or {{variable_name}}"
                        value={condition.value}
                        onChange={(e) => _updateCondition(condition.id, e.target.value, "value", find(fieldOptions, { value: condition.field }))}
                        isDisabled={(condition.operator === "isNotNull" || condition.operator === "isNull")}
                        labelPlacement="outside"
                        size="sm"
                        fullWidth
                      />
                    )}

                  {find(fieldOptions, { value: condition.field })
                    && find(fieldOptions, { value: condition.field }).type === "date" && (
                      <I18nProvider locale="en-GB">
                        <DatePicker
                          aria-label="Dataset filter date value"
                          name={`dataset-filter-date-${condition.id}`}
                          className="w-full"
                          value={(
                            condition.value
                            && parseDate(condition.value)
                          ) || null}
                          onChange={(date) => {
                            if (date) {
                              _updateCondition(
                                condition.id,
                                date.toString(),
                                "value",
                                find(fieldOptions, { value: condition.field }).type,
                              );
                            }
                          }}
                        >
                          <DateField.Group fullWidth variant="secondary" size="sm">
                            <DateField.Input>
                              {(segment) => <DateField.Segment segment={segment} />}
                            </DateField.Input>
                            <DateField.Suffix>
                              <DatePicker.Trigger>
                                <DatePicker.TriggerIndicator />
                              </DatePicker.Trigger>
                            </DateField.Suffix>
                          </DateField.Group>
                          <DatePicker.Popover>
                            <Calendar aria-label="Dataset filter date value">
                              <Calendar.Header>
                                <Calendar.YearPickerTrigger>
                                  <Calendar.YearPickerTriggerHeading />
                                  <Calendar.YearPickerTriggerIndicator />
                                </Calendar.YearPickerTrigger>
                                <Calendar.NavButton slot="previous" />
                                <Calendar.NavButton slot="next" />
                              </Calendar.Header>
                              <Calendar.Grid>
                                <Calendar.GridHeader>
                                  {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                                </Calendar.GridHeader>
                                <Calendar.GridBody>
                                  {(date) => <Calendar.Cell date={date} />}
                                </Calendar.GridBody>
                              </Calendar.Grid>
                              <Calendar.YearPickerGrid>
                                <Calendar.YearPickerGridBody>
                                  {({year}) => <Calendar.YearPickerCell year={year} />}
                                </Calendar.YearPickerGridBody>
                              </Calendar.YearPickerGrid>
                            </Calendar>
                          </DatePicker.Popover>
                        </DatePicker>
                      </I18nProvider>
                    )}
                </div>
              </Row>
            </Card.Content>
            {condition.value && _renderValueWithVariables(condition.value) && _renderValueWithVariables(condition.value).some(part => part.type === "variable") && (
              <>
                <Separator />
                <Card.Content>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Variables:</span>
                    <div className="flex flex-row gap-1 items-center flex-wrap">
                      {_renderValueWithVariables(condition.value).filter(part => part.type === "variable").map((part, index) => (
                        <div key={index}>
                          <code
                            className="cursor-pointer rounded-md bg-default/40 px-1.5 py-0.5 text-sm text-default-700 transition-colors duration-200 hover:bg-default/60"
                            onClick={() => _onVariableClick(part)}
                          >
                            {part.variable}
                          </code>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card.Content>
              </>
            )}
            <Separator />
            <Card.Footer className="justify-between gap-2">
              {!condition.saved && condition.field && (
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => _onApplyCondition(condition.id, condition.exposed)}
                      fullWidth
                    >
                      Apply
                      <LuCircleCheck size={18} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Apply this condition</Tooltip.Content>
                </Tooltip>
              )}

              <Tooltip>
                <Tooltip.Trigger>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => _onRemoveCondition(condition.id)}
                    fullWidth
                  >
                    Remove
                    <LuCircleX size={18} />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content>Remove filter</Tooltip.Content>
              </Tooltip>

              {condition.field && condition.operator && !condition.exposed && (
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => _onApplyCondition(
                        condition.id,
                        true,
                        find(fieldOptions, { value: condition.field })
                        && find(fieldOptions, { value: condition.field }).type
                      )}
                      fullWidth
                    >
                      Expose
                      <LuEye size={18} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Expose filter to viewers</Tooltip.Content>
                </Tooltip>
              )}

              {condition.field && condition.operator && condition.exposed && (
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button variant="ghost"
                      size="sm"
                      onPress={() => _onApplyCondition(
                        condition.id,
                        false,
                        find(fieldOptions, { value: condition.field })
                        && find(fieldOptions, { value: condition.field }).type
                      )}
                      fullWidth
                    >
                      Hide
                      <LuEyeOff size={18} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Hide this filter from viewers</Tooltip.Content>
                </Tooltip>
              )}

              {!condition.saved && condition.value && (
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => _onRevertCondition(condition.id)}
                      fullWidth
                    >
                      Undo
                      <LuRedo size={18} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Undo changes</Tooltip.Content>
                </Tooltip>
              )}
              {condition.saved && (
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => _onEditConditionSettings(condition)}
                      fullWidth
                    >
                      Config
                      <LuSettings size={18} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Filter settings</Tooltip.Content>
                </Tooltip>
              )}
            </Card.Footer>
          </Card>
        );
      })}
      {conditions?.length > 0 && (
        <div className="col-span-12">
          <Button
            variant="tertiary"
            onPress={_onAddCondition}
            size="sm"
          >
            Add a new filter
            <LuPlus />
          </Button>
          <div className="h-2" />
        </div>
      )}
      {conditions.filter((c) => c.exposed).length > 0 && (
        <div>
          <div>{"Exposed filters on the chart"}</div>
          <div className="h-1" />
          <div className="flex gap-1">
            {conditions.filter((c) => c.exposed).map((condition) => {
              return (
                <Chip
                  key={condition.id}
                  variant="soft"
                  className="rounded-sm"
                >
                  {condition.field.replace("root[].", "")}
                  <Link
                    onPress={() => _onApplyCondition(
                      condition.id,
                      false,
                      find(fieldOptions, { value: condition.field })
                      && find(fieldOptions, { value: condition.field }).type
                    )}
                  >
                    <LuCircleX size={16} />
                  </Link>
                </Chip>
              );
            })}
          </div>
        </div>
      )}

      <Modal.Backdrop isOpen={conditionModal} onOpenChange={setConditionModal}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
          <Modal.Header>
            <Modal.Heading>Filter settings</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
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
                variant="secondary"
              />
            </Row>
            <Row>
              <Input
                label="Assign a variable name to filter"
                placeholder="Enter a variable name"
                onChange={(e) => {
                  setSelectedCondition({ ...selectedCondition, variable: e.target.value });
                }}
                value={selectedCondition.variable}
                fullWidth
                variant="secondary"
                errorMessage={selectedCondition.variable && !_isVariableValid(selectedCondition.variable) && "Variables must start with a letter and contain only letters, numbers, and underscores"}
                description="Variables are used to reference the filter value in when embedding the chart or filtering on the dashboard"
              />
            </Row>
            <Row>
              <Checkbox
                id="dataset-filter-hide-values"
                isSelected={selectedCondition.hideValues}
                onChange={(selected) => {
                  setSelectedCondition({
                    ...selectedCondition,
                    hideValues: selected
                  });
                }}
              >
                <Checkbox.Control className="size-4 shrink-0">
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Content>
                  <Label htmlFor="dataset-filter-hide-values" className="text-sm">Hide existing values from the filter dropdown</Label>
                </Checkbox.Content>
              </Checkbox>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button
              onPress={() => setConditionModal(false)}
              variant="tertiary"
            >
              Close
            </Button>
            <Button
              onPress={_onConfirmConditionSettings}
              variant="primary"
              isDisabled={selectedCondition.variable && !_isVariableValid(selectedCondition.variable)}
              isPending={isLoading}
            >
              Save settings
            </Button>
          </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Variable Settings Drawer */}
      <Drawer
        isOpen={!!variableSettings}
        onOpenChange={(open) => {
          if (!open) setVariableSettings(null);
        }}
      >
        <Drawer.Backdrop variant="transparent" />
        <Drawer.Content
          placement="right"
          className="sm:data-[placement=right]:m-2 sm:data-[placement=left]:m-2 rounded-medium"
          style={{
            marginTop: "54px",
          }}
        >
          <Drawer.Dialog>
          <Drawer.Header
            className="flex flex-row items-center border-b-1 border-divider gap-2 px-2 py-2 justify-between bg-surface/50 backdrop-saturate-150 backdrop-blur-lg"
          >
            <Tooltip>
              <Tooltip.Trigger>
                <Button
                  isIconOnly
                  onPress={() => setVariableSettings(null)}
                  size="sm"
                  variant="ghost"
                >
                  <LuChevronsRight />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>Close</Tooltip.Content>
            </Tooltip>
            <div className="text-sm font-bold">Variable settings</div>
            <div className="flex flex-row items-center gap-2">
              <code className="rounded-sm bg-accent/20 px-1.5 py-0.5 text-sm text-accent-600">
                {variableSettings?.name}
              </code>
            </div>
          </Drawer.Header>
          <Drawer.Body>
            <div className="flex flex-col gap-2">
              <div className="text-sm font-bold text-gray-500">Variable name</div>
              <pre className="text-accent">
                {variableSettings?.name}
              </pre>
            </div>
            <div className="h-1" />
            <div className="flex flex-col gap-2">
              <div className="text-sm font-bold text-gray-500">Variable type</div>
              <Select
                placeholder="Select a variable type"
                fullWidth
                selectionMode="single"
                value={variableSettings?.type || null}
                onChange={(value) => setVariableSettings({ ...variableSettings, type: value })}
                variant="secondary"
              >
                <Label>Select a type</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="string" textValue="String">
                      String
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="number" textValue="Number">
                      Number
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="boolean" textValue="Boolean">
                      Boolean
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="date" textValue="Date">
                      Date
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            <div className="h-1" />
            <div className="flex flex-col gap-2">
              <div className="text-sm font-bold text-gray-500">Default value</div>
              <Input
                placeholder="Type a value here"
                fullWidth
                variant="secondary"
                value={variableSettings?.default_value || ""}
                onChange={(e) => setVariableSettings({ ...variableSettings, default_value: e.target.value })}
                description={variableSettings?.required && !variableSettings?.default_value && "This variable is required. The filter will fail if you don't provide a value."}
              />
            </div>
            <div className="h-1" />
            <div className="flex flex-col gap-2">
              <div className="text-sm font-bold text-gray-500">Required</div>
              <Switch
                isSelected={variableSettings?.required}
                onChange={(selected) => setVariableSettings({ ...variableSettings, required: selected })}
                size="sm"
                aria-label="Required"
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Button
              variant="tertiary"
              onPress={() => setVariableSettings(null)}
            >
              Close
            </Button>
            <Button
              variant="primary"
              onPress={_onVariableSave}
              isPending={variableLoading}
            >
              {variableLoading ? <ButtonSpinner /> : null}
              Save
            </Button>
          </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer>

    </div>
  );
}

DatasetFilters.propTypes = {
  onUpdate: PropTypes.func,
  fieldOptions: PropTypes.array,
  dataset: PropTypes.object,
};

export default DatasetFilters
