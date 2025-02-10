import React, { useState, useEffect, Fragment } from "react";
import PropTypes from "prop-types";
import moment from "moment";
import _ from "lodash";
import { v4 as uuid } from "uuid";
import {
  Dropdown, Spacer, Link as LinkNext, Input, Tooltip, Button, Modal, Chip,
  Divider, ModalHeader, ModalBody, ModalFooter, Tabs, Tab, DropdownTrigger,
  DropdownMenu, DropdownItem, ModalContent, DateRangePicker,
  Code, DatePicker,
  Autocomplete,
  AutocompleteItem,
} from "@heroui/react";
import { LuSquareCheck, LuInfo, LuPlus, LuX } from "react-icons/lu";

import { operators } from "../../../modules/filterOperations";
import Text from "../../../components/Text";
import Row from "../../../components/Row";
import { parseDate, parseDateTime, today } from "@internationalized/date";
import { useSelector } from "react-redux";
import { selectProject } from "../../../slices/project";
import { Link } from "react-router-dom";

function Filters(props) {
  const {
    charts, projectId, onAddFilter, open, onClose, filterGroups, onEditFilterGroup, onAddVariableFilter,
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
  const [initNewSelectionRange] = useState({
    start: parseDate(moment().startOf("month").format("YYYY-MM-DD")),
    end: parseDate(moment().endOf("month").format("YYYY-MM-DD")),
  });
  const [dateRange, setDateRange] = useState(initSelectionRange);
  const [newDateRange, setNewDateRange] = useState(initNewSelectionRange);
  const [variableCondition, setVariableCondition] = useState({
    variable: "", value: ""
  });

  const project = useSelector(selectProject);

  useEffect(() => {
    if (dateRange.startDate && dateRange.endDate) {
      setNewDateRange({
        start: parseDateTime(moment(dateRange.startDate).format("YYYY-MM-DDTHH:mm:ss")),
        end: parseDateTime(moment(dateRange.endDate).format("YYYY-MM-DDTHH:mm:ss")),
      });
    }
  }, [dateRange]);

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
    if (type === "this_month") {
      setDateRange({
        startDate: moment().startOf("month").startOf("day").toISOString(),
        endDate: moment().endOf("month").endOf("day").toISOString(),
        key: "selection",
      });
    }

    if (type === "last_month") {
      setDateRange({
        startDate: moment().subtract(1, "month").startOf("month").startOf("day")
          .toISOString(),
        endDate: moment().subtract(1, "month").endOf("month").endOf("day")
          .toISOString(),
        key: "selection",
      });
    }

    if (type === "last_7_days") {
      setDateRange({
        startDate: moment().subtract(7, "days").startOf("day").toISOString(),
        endDate: moment().endOf("day").toISOString(),
        key: "selection",
      });
    }

    if (type === "last_30_days") {
      setDateRange({
        startDate: moment().subtract(30, "days").startOf("day").toISOString(),
        endDate: moment().endOf("day").toISOString(),
        key: "selection",
      });
    }

    if (type === "last_90_days") {
      setDateRange({
        startDate: moment().subtract(90, "days").startOf("day").toISOString(),
        endDate: moment().endOf("day").toISOString(),
        key: "selection",
      });
    }

    if (type === "last_year") {
      setDateRange({
        startDate: moment().subtract(1, "year").startOf("day").toISOString(),
        endDate: moment().endOf("day").toISOString(),
        key: "selection",
      });
    }

    if (type === "quarter_to_date") {
      setDateRange({
        startDate: moment().startOf("quarter").startOf("day").toISOString(),
        endDate: moment().endOf("day").toISOString(),
        key: "selection",
      });
    }

    if (type === "last_quarter") {
      setDateRange({
        startDate: moment().subtract(1, "quarter").startOf("quarter").startOf("day")
          .toISOString(),
        endDate: moment().subtract(1, "quarter").endOf("quarter").endOf("day")
          .toISOString(),
        key: "selection",
      });
    }

    if (type === "year_to_date") {
      setDateRange({
        startDate: moment().startOf("year").startOf("day").toISOString(),
        endDate: moment().endOf("day").toISOString(),
        key: "selection",
      });
    }
  };

  const _onApplyFilter = () => {
    if (filterType === "date") {
      const startDate = moment([newDateRange.start.year, newDateRange.start.month - 1, newDateRange.start.day])
        .utcOffset(0, true).format();
      const endDate = moment([newDateRange.end.year, newDateRange.end.month - 1, newDateRange.end.day, 23, 59, 59])
        .utcOffset(0, true).format();

      onAddFilter({
        id: uuid(),
        startDate,
        endDate,
        type: "date",
      });
    } else {
      _onAddFilter();
    }
  };

  const _onAddVariableFilter = () => {
    onAddVariableFilter(variableCondition);
  };

  return (
    <Modal isOpen={open} onClose={onClose} closeButton size="3xl" className="dashboard-filters-modal">
      <ModalContent>
        <ModalHeader>
          <Text size="h3">Dashboard filters</Text>
        </ModalHeader>
        <ModalBody>
          <Row>
            <Tabs
              selectedKey={filterType}
              onSelectionChange={(selection) => setFilterType(selection)}
              disableAnimation
            >
              <Tab key="date" title="Date" />
              <Tab key="variables" title="Variables" />
              <Tab key="field" title="Matching field" />
            </Tabs>
          </Row>

          <Divider />

          {filterType === "date" && (
            <>
              <Row>
                <span>
                  {"The dashboard date filter will overwrite the global date settings in the selected charts as well as the "}
                  <Code size="sm">{"{{start_date}}"}</Code>
                  {" and "}
                  <Code size="sm">{"{{end_date}}"}</Code>
                  {" variables in the queries."}
                </span>
              </Row>
              <Row wrap="wrap" className={"gap-1"}>
                <LinkNext onPress={() => _onSelectRange("this_month")}>
                  <Chip color="primary" size="sm" variant={"bordered"} className="cursor-pointer">
                    This month
                  </Chip>
                </LinkNext>

                <LinkNext onPress={() => _onSelectRange("last_month")}>
                  <Chip color="primary" size="sm" variant={"bordered"} className="cursor-pointer">
                    Last month
                  </Chip>
                </LinkNext>
                
                <LinkNext onPress={() => _onSelectRange("last_7_days")}>
                  <Chip color="primary" size="sm" variant={"bordered"} className="cursor-pointer">
                    Last 7 days
                  </Chip>
                </LinkNext>
                
                <LinkNext onPress={() => _onSelectRange("last_30_days")}>
                  <Chip color="primary" size="sm" variant={"bordered"} className="cursor-pointer">
                    Last 30 days
                  </Chip>
                </LinkNext>
                
                <LinkNext onPress={() => _onSelectRange("last_90_days")}>
                  <Chip color="primary" size="sm" variant={"bordered"} className="cursor-pointer">
                    Last 90 days
                  </Chip>
                </LinkNext>
                
                <LinkNext onPress={() => _onSelectRange("last_year")}>
                  <Chip color="primary" size="sm" variant={"bordered"} className="cursor-pointer">
                    Last year
                  </Chip>
                </LinkNext>
                
                <LinkNext onPress={() => _onSelectRange("quarter_to_date")}>
                  <Chip color="primary" size="sm" variant={"bordered"} className="cursor-pointer">
                    Quarter to date
                  </Chip>
                </LinkNext>
                
                <LinkNext onPress={() => _onSelectRange("last_quarter")}>
                  <Chip color="primary" size="sm" variant={"bordered"} className="cursor-pointer">
                    Last quarter
                  </Chip>
                </LinkNext>
                
                <LinkNext onPress={() => _onSelectRange("year_to_date")}>
                  <Chip color="primary" size="sm" variant={"bordered"} className="cursor-pointer">
                    Year to date
                  </Chip>
                </LinkNext>
              </Row>
              <div>
                <DateRangePicker
                  variant="bordered"
                  label="Select a date range"
                  labelPlacement="inside"
                  visibleMonths={2}
                  value={newDateRange}
                  onChange={(value) => setNewDateRange(value)}
                  color="primary"
                />
              </div>
              <Row>
                <Text>
                  Select the charts that will be affected by the date filter
                </Text>
              </Row>
              <div className={"flex flex-row flex-wrap gap-1"}>
                <Button
                  variant="light"
                  startContent={<LuSquareCheck />}
                  size="sm"
                  onPress={() => onEditFilterGroup(null, true)}
                >
                  Select all
                </Button>
                <Button
                  variant="light"
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
            </>
          )}

          {filterType === "variables" && (
            <>
              <div className="flex flex-row gap-2 items-center">
                <Autocomplete
                  label="Select a variable"
                  variant="bordered"
                  selectedKey={variableCondition.variable}
                  onSelectionChange={(key) => setVariableCondition({ ...variableCondition, variable: key })}
                  aria-label="Select a variable"
                >
                  {project?.Variables?.map((variable) => (
                    <AutocompleteItem key={variable.name} textValue={variable.name}>
                      {variable.name}
                    </AutocompleteItem>
                  ))}
                </Autocomplete>
                
                <Input
                  label="Enter a value"
                  variant="bordered"
                  value={variableCondition.value}
                  onChange={(e) => setVariableCondition({ ...variableCondition, value: e.target.value })}
                />
              </div>

              <div>
                <Link to="../variables" className="text-primary-400">
                  Missing a variable? Click here to create new variables for this project.
                </Link>
              </div>
            </>
          )}

          {filterType === "field" && (
            <>
              <Row align="center" className={"gap-2"}>
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
              </Row>
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
        </ModalBody>
        <ModalFooter>
          <Button auto onPress={onClose} variant="bordered">
            Close
          </Button>
          {filterType === "date" && (
            <Button color="primary" onPress={_onApplyFilter}>
              Apply filter
            </Button>
          )}
          {filterType === "field" && (
            <Button
              endContent={<LuPlus />}
              isDisabled={!filter.value}
              onPress={_onAddFilter}
              color="primary"
            >
              Apply filter
            </Button>
          )}
          {filterType === "variables" && (
            <Button
              endContent={<LuPlus />}
              isDisabled={!variableCondition.variable || !variableCondition.value}
              onPress={_onAddVariableFilter}
              color="primary"
            >
              Add variable filter
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

Filters.propTypes = {
  charts: PropTypes.array.isRequired,
  projectId: PropTypes.number.isRequired,
  onAddFilter: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  filterGroups: PropTypes.array.isRequired,
  onEditFilterGroup: PropTypes.func.isRequired,
  onAddVariableFilter: PropTypes.func.isRequired,
};

export default Filters;
