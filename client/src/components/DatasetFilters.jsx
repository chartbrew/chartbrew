import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch } from "react-redux";
import {
  Autocomplete, AutocompleteItem, Button, Card, CardBody, CardFooter, CardHeader,
  Checkbox, Chip, DatePicker, Divider, Drawer, DrawerBody, DrawerContent, DrawerFooter,
  DrawerHeader, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input, Link, 
  Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem,
  Spacer, Switch, Tooltip, Code,
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
import Text from "./Text";
import { operators } from "../modules/filterOperations";
import { createDatasetVariableBinding, updateDatasetVariableBinding } from "../slices/dataset";

function DatasetFilters(props) {
  const { onUpdate, fieldOptions, dataset } = props;

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
            variant="bordered"
            startContent={<LuListFilter />}
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
          <Card key={condition.id} className="datasetdata-filters-tut shadow-none border-1 border-content3 border-solid rounded-lg">
            <CardHeader>
              {index === 0 && (<Text>{"where "}</Text>)}
              {index > 0 && (<Text>{"and "}</Text>)}
            </CardHeader>
            <Divider />
            <CardBody>
              <Autocomplete
                variant="bordered"
                placeholder="Field"
                selectedKey={condition.field}
                onSelectionChange={(key) => _updateCondition(condition.id, key, "field")}
                labelPlacement="outside"
                size="sm"
                aria-label="Field"
              >
                {fieldOptions.filter((f) => !f.isObject).map((field) => (
                  <AutocompleteItem
                    key={field.value}
                    startContent={(
                      <Chip size="sm" variant="flat" className={"min-w-[70px] text-center"} color={field.label.color}>{field.label.content}</Chip>
                    )}
                    textValue={field.text}
                  >
                    {field.text}
                  </AutocompleteItem>
                ))}
              </Autocomplete>
              <Spacer y={1} />
              <Row warp="wrap" className={"flex gap-2"} align="center">
                <Dropdown aria-label="Select an operator">
                  <DropdownTrigger>
                    <Input
                      value={
                        (
                          find(operators, { value: condition.operator })
                          && find(operators, { value: condition.operator }).key
                        )
                        || "="
                      }
                      variant="bordered"
                      labelPlacement="outside"
                      className="max-w-[100px]"
                      size="sm"
                    />
                  </DropdownTrigger>
                  <DropdownMenu
                    onSelectionChange={(keys) => _updateCondition(condition.id, keys.currentKey, "operator")}
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
                    || (find(fieldOptions, { value: condition.field })
                      && find(fieldOptions, { value: condition.field }).type !== "date")) && (
                      <div className="flex flex-col gap-2">
                        <Input
                          placeholder="Enter a value or {{variable_name}}"
                          value={condition.value}
                          onChange={(e) => _updateCondition(condition.id, e.target.value, "value", find(fieldOptions, { value: condition.field }))}
                          disabled={(condition.operator === "isNotNull" || condition.operator === "isNull")}
                          labelPlacement="outside"
                          variant="bordered"
                          size="sm"
                        />
                      </div>
                    )}

                  {find(fieldOptions, { value: condition.field })
                    && find(fieldOptions, { value: condition.field }).type === "date" && (
                      <I18nProvider locale="en-GB">
                        <DatePicker
                          variant="bordered"
                          showMonthAndYearPickers
                          value={(
                            condition.value
                            && parseDate(condition.value)
                          ) || null}
                          onChange={(date) => _updateCondition(condition.id, date.toString(), "value", find(fieldOptions, { value: condition.field }).type)}
                          size="sm"
                        />
                      </I18nProvider>
                    )}
                </div>
              </Row>
            </CardBody>
            {condition.value && _renderValueWithVariables(condition.value) && _renderValueWithVariables(condition.value).some(part => part.type === "variable") && (
              <>
                <Divider />
                <CardBody>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Variables:</span>
                    <div className="flex flex-row gap-1 items-center flex-wrap">
                      {_renderValueWithVariables(condition.value).filter(part => part.type === "variable").map((part, index) => (
                        <div key={index}>
                          <Code
                            size="sm"
                            className="cursor-pointer hover:bg-primary-100 transition-colors duration-200"
                            variant="flat"
                            onClick={() => _onVariableClick(part)}
                          >
                            {part.variable}
                          </Code>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardBody>
              </>
            )}
            <Divider />
            <CardFooter className="justify-between gap-2">
              {!condition.saved && condition.field && (
                <Tooltip content="Apply this condition">
                  <Button
                    color="success"
                    endContent={<LuCircleCheck size={18} />}
                    variant="light"
                    size="sm"
                    onClick={() => _onApplyCondition(condition.id, condition.exposed)}
                    fullWidth
                  >
                    Apply
                  </Button>
                </Tooltip>
              )}

              <Tooltip content="Remove filter">
                <Button
                  color="danger"
                  endContent={<LuCircleX size={18} />}
                  variant="light"
                  size="sm"
                  onClick={() => _onRemoveCondition(condition.id)}
                  fullWidth
                >
                  Remove
                </Button>
              </Tooltip>

              {condition.field && condition.operator && !condition.exposed && (
                <Tooltip content="Expose filter to viewers">
                  <Button
                    endContent={<LuEye size={18} />}
                    color="secondary"
                    variant="light"
                    size="sm"
                    onClick={() => _onApplyCondition(
                      condition.id,
                      true,
                      find(fieldOptions, { value: condition.field })
                      && find(fieldOptions, { value: condition.field }).type
                    )}
                    fullWidth
                  >
                    Expose
                  </Button>
                </Tooltip>
              )}

              {condition.field && condition.operator && condition.exposed && (
                <Tooltip content="Hide this filter from viewers">
                  <Button
                    color="secondary"
                    variant="light"
                    size="sm"
                    endContent={<LuEyeOff size={18} />}
                    onClick={() => _onApplyCondition(
                      condition.id,
                      false,
                      find(fieldOptions, { value: condition.field })
                      && find(fieldOptions, { value: condition.field }).type
                    )}
                    fullWidth
                  >
                    Hide
                  </Button>
                </Tooltip>
              )}

              {!condition.saved && condition.value && (
                <Tooltip content="Undo changes">
                  <Button
                    color="warning"
                    endContent={<LuRedo size={18} />}
                    variant="light"
                    size="sm"
                    onClick={() => _onRevertCondition(condition.id)}
                    fullWidth
                  >
                    Undo
                  </Button>
                </Tooltip>
              )}
              {condition.saved && (
                <Tooltip content="Filter settings">
                  <Button
                    variant="light"
                    size="sm"
                    endContent={<LuSettings size={18} />}
                    onClick={() => _onEditConditionSettings(condition)}
                    fullWidth
                  >
                    Config
                  </Button>
                </Tooltip>
              )}
            </CardFooter>
          </Card>
        );
      })}
      {conditions?.length > 0 && (
        <div className="col-span-12">
          <Button
            variant="flat"
            onClick={_onAddCondition}
            endContent={<LuPlus />}
            size="sm"
          >
            Add a new filter
          </Button>
          <Spacer y={2} />
        </div>
      )}
      {conditions.filter((c) => c.exposed).length > 0 && (
        <div>
          <div>{"Exposed filters on the chart"}</div>
          <Spacer y={1} />
          <div className="flex gap-1">
            {conditions.filter((c) => c.exposed).map((condition) => {
              return (
                <Chip
                  key={condition.id}
                  radius="sm"
                  variant="faded"
                  endContent={(
                    <Link
                      onClick={() => _onApplyCondition(
                        condition.id,
                        false,
                        find(fieldOptions, { value: condition.field })
                        && find(fieldOptions, { value: condition.field }).type
                      )}
                      color="danger"
                    >
                      <LuCircleX size={16} />
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

      <Modal isOpen={conditionModal} size="lg" onClose={() => setConditionModal(false)}>
        <ModalContent>
          <ModalHeader>
            <Text size="h4">Filter settings</Text>
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
              <Input
                label="Assign a variable name to filter"
                placeholder="Enter a variable name"
                onChange={(e) => {
                  setSelectedCondition({ ...selectedCondition, variable: e.target.value });
                }}
                value={selectedCondition.variable}
                fullWidth
                variant="bordered"
                errorMessage={selectedCondition.variable && !_isVariableValid(selectedCondition.variable) && "Variables must start with a letter and contain only letters, numbers, and underscores"}
                description="Variables are used to reference the filter value in when embedding the chart or filtering on the dashboard"
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
              isDisabled={selectedCondition.variable && !_isVariableValid(selectedCondition.variable)}
              isLoading={isLoading}
            >
              Save settings
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Variable Settings Drawer */}
      <Drawer
        isOpen={!!variableSettings}
        onClose={() => setVariableSettings(null)}
        placement="right"
        classNames={{
          base: "data-[placement=right]:sm:m-2 data-[placement=left]:sm:m-2 rounded-medium",
        }}
        style={{
          marginTop: "54px",
        }}
        backdrop="transparent"
      >
        <DrawerContent>
          <DrawerHeader
            className="flex flex-row items-center border-b-1 border-divider gap-2 px-2 py-2 justify-between bg-content1/50 backdrop-saturate-150 backdrop-blur-lg"
          >
            <Tooltip content="Close">
              <Button
                isIconOnly
                onPress={() => setVariableSettings(null)}
                size="sm"
                variant="light"
              >
                <LuChevronsRight />
              </Button>
            </Tooltip>
            <div className="text-sm font-bold">Variable settings</div>
            <div className="flex flex-row items-center gap-2">
              <Code color="primary" radius="sm" variant="flat" className="text-sm">
                {variableSettings?.name}
              </Code>
            </div>
          </DrawerHeader>
          <DrawerBody>
            <div className="flex flex-col gap-2">
              <div className="text-sm font-bold text-gray-500">Variable name</div>
              <pre className="text-primary">
                {variableSettings?.name}
              </pre>
            </div>
            <Spacer y={1} />
            <div className="flex flex-col gap-2">
              <div className="text-sm font-bold text-gray-500">Variable type</div>
              <Select
                label="Select a type"
                placeholder="Select a variable type"
                fullWidth
                selectedKeys={[variableSettings?.type]}
                onSelectionChange={(keys) => setVariableSettings({ ...variableSettings, type: keys.currentKey })}
                variant="bordered"
              >
                <SelectItem key="string">String</SelectItem>
                <SelectItem key="number">Number</SelectItem>
                <SelectItem key="boolean">Boolean</SelectItem>
                <SelectItem key="date">Date</SelectItem>
              </Select>
            </div>
            <Spacer y={1} />
            <div className="flex flex-col gap-2">
              <div className="text-sm font-bold text-gray-500">Default value</div>
              <Input
                placeholder="Type a value here"
                fullWidth
                variant="bordered"
                value={variableSettings?.default_value || ""}
                onChange={(e) => setVariableSettings({ ...variableSettings, default_value: e.target.value })}
                description={variableSettings?.required && !variableSettings?.default_value && "This variable is required. The filter will fail if you don't provide a value."}
              />
            </div>
            <Spacer y={1} />
            <div className="flex flex-col gap-2">
              <div className="text-sm font-bold text-gray-500">Required</div>
              <Switch
                isSelected={variableSettings?.required}
                onValueChange={(selected) => setVariableSettings({ ...variableSettings, required: selected })}
                size="sm"
              />
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button
              variant="flat"
              onPress={() => setVariableSettings(null)}
            >
              Close
            </Button>
            <Button
              color="primary"
              onPress={_onVariableSave}
              isLoading={variableLoading}
            >
              Save
            </Button>
          </DrawerFooter>
        </DrawerContent>
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
