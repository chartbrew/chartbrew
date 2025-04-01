import React, { useState, useEffect, Fragment } from "react";
import PropTypes from "prop-types";
import moment from "moment";
import _ from "lodash";
import { v4 as uuid } from "uuid";
import {
  Dropdown, Spacer, Link as LinkNext, Input, Tooltip, Button, Chip,
  Divider,
  Code,
  Autocomplete,
  AutocompleteItem,
  Drawer,
  DrawerFooter,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  Select,
  SelectItem,
  Checkbox,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DatePicker,
} from "@heroui/react";
import { LuSquareCheck, LuInfo, LuPlus, LuX } from "react-icons/lu";
import { toast } from "react-hot-toast";
import { parseDate, today } from "@internationalized/date";

import { operators } from "../../../modules/filterOperations";
import Text from "../../../components/Text";
import Row from "../../../components/Row";
import { useSelector } from "react-redux";
import { selectProject } from "../../../slices/project";
import { Link } from "react-router-dom";
import VariableFilter from "./VariableFilter";
import DateRangeFilter from "./DateRangeFilter";

function AddFilters(props) {
  const {
    charts, projectId, onAddFilter, open, onClose, filterGroups, onEditFilterGroup, onAddVariableFilter, filters,
  } = props;

  const [fieldOptions, setFieldOptions] = useState([]);
  const [filter, setFilter] = useState({
    id: uuid(),
    field: "",
    operator: "is",
    value: "",
    projectId,
  });
  const [filterType, setFilterType] = useState("date");
  const [initSelectionRange] = useState({
    startDate: moment().startOf("month").toISOString(),
    endDate: moment().endOf("month").toISOString(),
    key: "selection",
  });
  const [dateRange, setDateRange] = useState(initSelectionRange);
  const [variableCondition, setVariableCondition] = useState({
    variable: "", 
    value: "",
    dataType: "text",
    label: "",
    allowValueChange: false,
  });
  const [rangeActive, setRangeActive] = useState(false);

  const project = useSelector(selectProject);

  useEffect(() => {
    if (charts) {
      const tempFieldOptions = [];
      charts.map((chart) => {
        if (chart.ChartDatasetConfigs) {
          chart.ChartDatasetConfigs.forEach((cdc) => {
            if (cdc.Dataset?.fieldsSchema) {
              Object.keys(cdc.Dataset?.fieldsSchema).forEach((key) => {
                const type = cdc.Dataset?.fieldsSchema[key];
                if (_.findIndex(tempFieldOptions, { key }) !== -1) return;
                tempFieldOptions.push({
                  key,
                  text: key && key.replace("root[].", "").replace("root.", ""),
                  value: key,
                  type,
                  chart_id: chart.id,
                  label: {
                    content: type || "unknown",
                    color: type === "date" ? "warning"
                      : type === "number" ? "success"
                        : type === "string" ? "primary"
                          : type === "boolean" ? "warning"
                            : "neutral"
                  },
                });
              });
            }
          });
        }
        return chart;
      });

      setFieldOptions(tempFieldOptions);
    }
  }, [charts]);

  const _updateFilter = (value, type) => {
    const newFilter = _.clone(filter);
    newFilter[type] = value;
    newFilter.saved = false;

    if (type === "field") {
      newFilter.value = "";
    }

    setFilter(newFilter);
  };

  const _getChartsWithField = (field) => {
    const chartsFound = [];
    charts.map((chart) => {
      let found = false;
      if (chart.ChartDatasetConfigs) {
        chart.ChartDatasetConfigs.forEach((cdc) => {
          if (cdc.Dataset?.fieldsSchema) {
            Object.keys(cdc.Dataset.fieldsSchema).forEach((key) => {
              if (key === field) found = true;
            });
          }
        });
      }

      if (found) chartsFound.push(chart);
      return chart;
    });

    return chartsFound;
  };

  const _onAddFilter = () => {
    if (!filter.value && filter.value !== false) return;
    onAddFilter(filter);
    setFilter({
      id: uuid(),
      field: "",
      operator: "is",
      value: "",
      projectId,
    });
  };

  const _onSelectRange = (type) => {
    setRangeActive(type);
    setTimeout(() => {
      setRangeActive(false);
    }, 1000);

    let startDate;
    let endDate;

    if (type === "this_month") {
      startDate = moment().startOf("month").startOf("day").toISOString();
      endDate = moment().endOf("month").endOf("day").toISOString();
    }

    if (type === "last_month") {
      startDate = moment().subtract(1, "month").startOf("month").startOf("day").toISOString();
      endDate = moment().subtract(1, "month").endOf("month").endOf("day").toISOString();
    }

    if (type === "last_7_days") {
      startDate = moment().subtract(7, "days").startOf("day").toISOString();
      endDate = moment().endOf("day").toISOString();
    }

    if (type === "last_30_days") {
      startDate = moment().subtract(30, "days").startOf("day").toISOString();
      endDate = moment().endOf("day").toISOString();
    }

    if (type === "last_90_days") {
      startDate = moment().subtract(90, "days").startOf("day").toISOString();
      endDate = moment().endOf("day").toISOString();
    }

    if (type === "last_year") {
      startDate = moment().subtract(1, "year").startOf("day").toISOString();
      endDate = moment().endOf("day").toISOString();
    }

    if (type === "quarter_to_date") {
      startDate = moment().startOf("quarter").startOf("day").toISOString();
      endDate = moment().endOf("day").toISOString();
    }

    if (type === "last_quarter") {
      startDate = moment().subtract(1, "quarter").startOf("quarter").startOf("day").toISOString();
      endDate = moment().subtract(1, "quarter").endOf("quarter").endOf("day").toISOString();
    }

    if (type === "year_to_date") {
      startDate = moment().startOf("year").startOf("day").toISOString();
      endDate = moment().endOf("day").toISOString();
    }

    setDateRange({ startDate, endDate });
  };

  const _onApplyFilter = () => {
    if (filterType === "date") {
      onAddFilter({
        id: uuid(),
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        type: "date",
      });
    } else {
      _onAddFilter();
    }
  };

  const _onAddVariableFilter = () => {
    // Check if a filter for this variable already exists
    const existingVariableFilter = filters?.[projectId]?.find(
      f => f.type === "variable" && f.variable === variableCondition.variable
    );

    if (existingVariableFilter) {
      toast.error("A filter for this variable already exists");
      return;
    }

    onAddVariableFilter(variableCondition);
    setVariableCondition({
      variable: "",
      value: "",
      dataType: "text",
      label: "",
      allowValueChange: false,
    });
  };

  if (!open) return null;

  return (
    <Drawer isOpen={open} onClose={onClose} closeButton size="2xl" placement="left" className="dashboard-filters-modal">
      <DrawerContent className="pt-[3rem]">
        <DrawerHeader>
          <span className="font-bold text-lg">Add dashboard filter</span>
        </DrawerHeader>
        <DrawerBody>
          <Select
            label="Select a filter type"
            variant="bordered"
            selectedKeys={[filterType]}
            onSelectionChange={(keys) => setFilterType(keys.currentKey)}
          >
            <SelectItem key="date" textValue="Date">
              Date
            </SelectItem>
            <SelectItem key="variables" textValue="Variables">
              Variables
            </SelectItem>
            <SelectItem key="field" textValue="Matching field">
              Matching field
            </SelectItem>
          </Select>

          <Divider />

          {filterType === "date" && (
            <>
              <div className="font-bold">
                Configure the date filter
              </div>

              <div className="text-sm">
                Select the charts that will be affected by the date filter
              </div>
              <div className={"flex flex-row flex-wrap gap-1"}>
                <Button
                  variant="flat"
                  startContent={<LuSquareCheck />}
                  size="sm"
                  onPress={() => onEditFilterGroup(null, true)}
                >
                  Select all
                </Button>
                <Button
                  variant="flat"
                  startContent={<LuX />}
                  size="sm"
                  onPress={() => onEditFilterGroup(null, false, true)}
                >
                  Deselect all
                </Button>
              </div>
              <div className={"flex flex-row flex-wrap gap-1"}>
                {charts.filter(c => c.type !== "markdown").map((chart) => (
                  <Fragment key={chart.id}>
                    <LinkNext onPress={() => onEditFilterGroup(chart.id)}>
                      <Chip
                        className="cursor-pointer"
                        color={filterGroups.find(c => c === chart.id) ? "primary" : "default"}
                        radius="sm"
                        variant={filterGroups.find(c => c === chart.id) ? "solid" : "flat"}
                      >
                        {chart.name}
                      </Chip>
                    </LinkNext>
                  </Fragment>
                ))}
              </div>
              <Spacer y={1} />
              <Row wrap="wrap" className={"gap-1"}>
                <LinkNext onPress={() => _onSelectRange("this_month")}>
                  <Chip
                    size="sm"
                    variant={"flat"}
                    className="cursor-pointer"
                    color={rangeActive === "this_month" ? "primary" : "default"}
                  >
                    This month
                  </Chip>
                </LinkNext>

                <LinkNext onPress={() => _onSelectRange("last_month")}>
                  <Chip
                    size="sm"
                    variant={"flat"}
                    className="cursor-pointer"
                    color={rangeActive === "last_month" ? "primary" : "default"}
                  >
                    Last month
                  </Chip>
                </LinkNext>
                
                <LinkNext onPress={() => _onSelectRange("last_7_days")}>
                  <Chip
                    size="sm"
                    variant={"flat"}
                    className="cursor-pointer"
                    color={rangeActive === "last_7_days" ? "primary" : "default"}
                  >
                    Last 7 days
                  </Chip>
                </LinkNext>
                
                <LinkNext onPress={() => _onSelectRange("last_30_days")}>
                  <Chip
                    size="sm"
                    variant={"flat"}
                    className="cursor-pointer"
                    color={rangeActive === "last_30_days" ? "primary" : "default"}
                  >
                    Last 30 days
                  </Chip>
                </LinkNext>
                
                <LinkNext onPress={() => _onSelectRange("last_90_days")}>
                  <Chip
                    size="sm"
                    variant={"flat"}
                    className="cursor-pointer"
                    color={rangeActive === "last_90_days" ? "primary" : "default"}
                  >
                    Last 90 days
                  </Chip>
                </LinkNext>
                
                <LinkNext onPress={() => _onSelectRange("last_year")}>
                  <Chip
                    size="sm"
                    variant={"flat"}
                    className="cursor-pointer"
                    color={rangeActive === "last_year" ? "primary" : "default"}
                  >
                    Last year
                  </Chip>
                </LinkNext>
                
                <LinkNext onPress={() => _onSelectRange("quarter_to_date")}>
                  <Chip
                    size="sm"
                    variant={"flat"}
                    className="cursor-pointer"
                    color={rangeActive === "quarter_to_date" ? "primary" : "default"}
                  >
                    Quarter to date
                  </Chip>
                </LinkNext>
                
                <LinkNext onPress={() => _onSelectRange("last_quarter")}>
                  <Chip
                    size="sm"
                    variant={"flat"}
                    className="cursor-pointer"
                    color={rangeActive === "last_quarter" ? "primary" : "default"}
                  >
                    Last quarter
                  </Chip>
                </LinkNext>
                
                <LinkNext onPress={() => _onSelectRange("year_to_date")}>
                  <Chip
                    size="sm"
                    variant={"flat"}
                    className="cursor-pointer transition-colors duration-500"
                    color={rangeActive === "year_to_date" ? "primary" : "default"}
                  >
                    Year to date
                  </Chip>
                </LinkNext>
              </Row>
              <div>
                <DateRangeFilter
                  startDate={dateRange.startDate}
                  endDate={dateRange.endDate}
                  onChange={({ startDate, endDate }) => setDateRange({ startDate, endDate })}
                  showLabel
                  size="lg"
                />
              </div>
              <div className="flex flex-row">
                <span className="text-sm">
                  {"The dashboard date filter will overwrite the global date settings in the selected charts as well as the "}
                  <Code size="sm" className="text-sm">{"{{start_date}}"}</Code>
                  {" and "}
                  <Code size="sm" className="text-sm">{"{{end_date}}"}</Code>
                  {" variables in the queries."}
                </span>
              </div>
            </>
          )}

          {filterType === "variables" && (
            <>
              <div className="flex flex-col gap-4">
                <div className="font-bold">
                  Configure the variable filter
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-row gap-2 items-center">
                    <Input
                      label="Filter label"
                      variant="bordered"
                      value={variableCondition.label}
                      onChange={(e) => setVariableCondition({ ...variableCondition, label: e.target.value })}
                      size="sm"
                    />

                    <Autocomplete
                      label="Select a variable"
                      variant="bordered"
                      selectedKey={variableCondition.variable}
                      onSelectionChange={(key) => setVariableCondition({ ...variableCondition, variable: key, label: variableCondition.label || key })}
                      aria-label="Select a variable"
                      size="sm"
                    >
                      {project?.Variables?.map((variable) => (
                        <AutocompleteItem key={variable.name} textValue={variable.name}>
                          {variable.name}
                        </AutocompleteItem>
                      ))}
                    </Autocomplete>
                  </div>

                  <div className="flex flex-row gap-2 items-center">
                    <Select
                      label="Data type"
                      variant="bordered"
                      selectedKeys={[variableCondition.dataType]}
                      onSelectionChange={(keys) => {
                        if (keys.currentKey === "date") {
                          setVariableCondition({ ...variableCondition, value: today(), dataType: keys.currentKey });
                        } else {
                          setVariableCondition({ ...variableCondition, dataType: keys.currentKey });
                        }
                      }}
                      size="sm"
                    >
                      <SelectItem key="text" textValue="Text">
                        Text
                      </SelectItem>
                      <SelectItem key="number" textValue="Number">
                        Number
                      </SelectItem>
                      <SelectItem key="date" textValue="Date">
                        Date
                      </SelectItem>
                      <SelectItem key="binary" textValue="Binary">
                        Binary
                      </SelectItem>
                    </Select>

                    {variableCondition.dataType === "date" ? (
                      <DatePicker
                        label="Select a date"
                        value={variableCondition.value ? parseDate(moment(variableCondition.value).format("YYYY-MM-DD")) : today()}
                        onChange={(date) => setVariableCondition({ ...variableCondition, value: date.toString() })}
                        variant="bordered"
                        showMonthAndYearPickers
                        calendarProps={{ color: "primary" }}
                        size="sm"
                      />
                    ) : variableCondition.dataType === "number" ? (
                      <Input
                        label="Enter a number"
                        variant="bordered"
                        type="number"
                        value={variableCondition.value}
                        onChange={(e) => setVariableCondition({ ...variableCondition, value: e.target.value })}
                        size="sm"
                      />
                    ) : variableCondition.dataType === "binary" ? (
                      <Select
                        label="Select value"
                        variant="bordered"
                        selectedKeys={[variableCondition.value]}
                        onSelectionChange={(keys) => setVariableCondition({ ...variableCondition, value: keys.currentKey })}
                        size="sm"
                      >
                        <SelectItem key="true" textValue="True">
                          True
                        </SelectItem>
                        <SelectItem key="false" textValue="False">
                          False
                        </SelectItem>
                      </Select>
                    ) : (
                      <Input
                        label="Enter a value"
                        variant="bordered"
                        value={variableCondition.value}
                        onChange={(e) => setVariableCondition({ ...variableCondition, value: e.target.value })}
                        size="sm"
                      />
                    )}
                  </div>

                  <div className="flex flex-row gap-2 items-center">
                    <Checkbox
                      isSelected={variableCondition.allowValueChange}
                      onValueChange={(isSelected) => setVariableCondition({ ...variableCondition, allowValueChange: isSelected })}
                      size="sm"
                    >
                      Allow value change
                    </Checkbox>
                  </div>
                </div>

                <div>
                  <Link to="../variables" className="text-primary-400 text-sm">
                    Missing a variable? Click here to create new variables for this project.
                  </Link>
                </div>

                <Divider />

                <div>
                  <div className="mb-2 font-bold">Preview filter</div>
                  <VariableFilter
                    filter={variableCondition}
                    onValueChange={(value) => setVariableCondition({ ...variableCondition, value })}
                    onApply={() => {}}
                  />
                </div>
              </div>
            </>
          )}

          {filterType === "field" && (
            <>
              <div className="font-bold">
                Configure the field filter
              </div>
              <div className="flex flex-row gap-2 items-center">
                <Autocomplete
                  label="Select a field"
                  value={() => (
                    <span>{(filter.field && filter.field.substring(filter.field.lastIndexOf(".") + 1)) || "Select a field"}</span>
                  )}
                  selectedKey={filter.field}
                  onSelectionChange={(key) => _updateFilter(key, "field")}
                  size="sm"
                  variant="bordered"
                  aria-label="Select a field"
                >
                  {fieldOptions.map((field) => (
                    <AutocompleteItem
                      key={field.value}
                      startContent={(
                        <Chip variant="flat" size="sm" color={field.label.color} className="min-w-[70px] text-center">
                          {field.type}
                        </Chip>
                      )}
                      textValue={field.text}
                    >
                      {field.text}
                    </AutocompleteItem>
                  ))}
                </Autocomplete>
                <Spacer x={0.5} />
                <Dropdown aria-label="Select an operator">
                  <DropdownTrigger>
                    <Button
                      variant="flat"
                      color="default"
                    >
                      {(_.find(operators, { value: filter.operator })
                        && _.find(operators, { value: filter.operator }).key)
                        || "="}
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    selectionMode="single"
                    selectedKeys={[filter.operator]}
                    onSelectionChange={(selection) => _updateFilter(Object.values(selection)[0], "operator")}
                  >
                    {operators.map((op) => (
                      <DropdownItem key={op.value} textValue={op.text}>
                        {op.text}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </Dropdown>
                <Spacer x={0.5} />
                {(!filter.field
                  || (_.find(fieldOptions, { value: filter.field })
                    && _.find(fieldOptions, { value: filter.field }).type !== "date")) && (
                    <Input
                      label="Enter a value"
                      labelPlacement="inside"
                      value={filter.value}
                      onChange={(e) => _updateFilter(e.target.value, "value")}
                      variant="bordered"
                      size="sm"
                    />
                )}
                {_.find(fieldOptions, { value: filter.field })
                  && _.find(fieldOptions, { value: filter.field }).type === "date" && (
                    <DatePicker
                      label="Select a date"
                      value={(filter.value && parseDate(filter.value)) || today()}
                      onChange={(date) => _updateFilter(date.toString(), "value")}
                      variant="bordered"
                      showMonthAndYearPickers
                      calendarProps={{ color: "primary" }}
                    />
                  )}
                <Spacer x={0.5} />
                <Tooltip content={"If you can't see your fields, please go in each chart and re-run the queries. Chartbrew will then index the fields and then they will appear here."} css={{ zIndex: 99999 }}>
                  <LinkNext className="text-primary-400">
                    <LuInfo />
                  </LinkNext>
                </Tooltip>
              </div>
              {filter.field && (
                <>
                  <Row align="center">
                    <Text b>The filter will affect the following charts:</Text>
                  </Row>
                  <Row wrap="wrap" className={"gap-1"}>
                    {_getChartsWithField(filter.field).map((chart) => (
                      <>
                        <Chip color="primary" key={chart.id} radius="sm" variant="flat">
                          {chart.name}
                        </Chip>
                      </>
                    ))}
                  </Row>
                </>
              )}
            </>
          )}
        </DrawerBody>
        <DrawerFooter>
          <Button auto onPress={onClose} variant="bordered">
            Close
          </Button>
          {filterType === "date" && (
            <Button color="primary" onPress={_onApplyFilter}>
              Add filter
            </Button>
          )}
          {filterType === "field" && (
            <Button
              endContent={<LuPlus />}
              onPress={_onAddFilter}
              color="primary"
            >
              Add filter
            </Button>
          )}
          {filterType === "variables" && (
            <Button
              endContent={<LuPlus />}
              isDisabled={!variableCondition.variable}
              onPress={_onAddVariableFilter}
              color="primary"
            >
              Add filter
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

AddFilters.propTypes = {
  charts: PropTypes.array.isRequired,
  projectId: PropTypes.number.isRequired,
  onAddFilter: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  filterGroups: PropTypes.array.isRequired,
  onEditFilterGroup: PropTypes.func.isRequired,
  onAddVariableFilter: PropTypes.func.isRequired,
  filters: PropTypes.object,
};

export default AddFilters;
