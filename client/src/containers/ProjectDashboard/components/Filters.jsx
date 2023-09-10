import React, { useState, useEffect, Fragment } from "react";
import PropTypes from "prop-types";
import moment from "moment";
import _ from "lodash";
import uuid from "uuid/v4";
import { formatISO, format } from "date-fns";
import { Calendar, DateRange } from "react-date-range";
import { enGB } from "date-fns/locale";
import {
  Dropdown, Spacer, Link as LinkNext, Input, Popover,
  Tooltip, Button, Modal, Chip, Divider, ModalHeader, ModalBody, ModalFooter, Tabs, Tab, PopoverTrigger, PopoverContent, DropdownTrigger, DropdownMenu, DropdownItem,
} from "@nextui-org/react";
import { Calendar as CalendarIcon, InfoCircle, Plus } from "react-iconly";

import { operators } from "../../../modules/filterOperations";
import { primary, secondary } from "../../../config/colors";
import Container from "../../../components/Container";
import Text from "../../../components/Text";
import Row from "../../../components/Row";

function Filters(props) {
  const {
    charts, projectId, onAddFilter, open, onClose, filterGroups, onEditFilterGroup,
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

  useEffect(() => {
    if (charts) {
      const tempFieldOptions = [];
      charts.map((chart) => {
        if (chart.Datasets) {
          chart.Datasets.map((dataset) => {
            if (dataset.fieldsSchema) {
              Object.keys(dataset.fieldsSchema).forEach((key) => {
                const type = dataset.fieldsSchema[key];
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
            return dataset;
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
      if (chart.Datasets) {
        chart.Datasets.map((dataset) => {
          if (dataset.fieldsSchema) {
            Object.keys(dataset.fieldsSchema).forEach((key) => {
              if (key === field) found = true;
            });
          }
          return dataset;
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

  const _onChangeDateRange = (ranges) => {
    const range = ranges.selection;
    setDateRange({
      startDate: moment(range.startDate).toISOString(),
      endDate: moment(range.endDate).toISOString(),
    });
  };

  const _onApplyFilter = () => {
    if (filterType === "date") {
      onAddFilter({
        id: uuid(),
        startDate: moment(dateRange.startDate).utcOffset(0, true).format(),
        endDate: moment(dateRange.endDate).utcOffset(0, true).format(),
        type: "date",
      });
    } else {
      _onAddFilter();
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} closeButton className="w-[800px]">
      <ModalHeader>
        <Text h3>Dashboard filters</Text>
      </ModalHeader>
      <ModalBody>
        <Container>
          <Row>
            <Tabs
              selectedKey={filterType}
              onSelectionChange={(selection) => setFilterType(selection)}
            >
              <Tab key="date" title="Date" />
              <Tab key="custom" title="Custom" />
            </Tabs>
          </Row>
          <Spacer y={1} />
          <Divider />
          <Spacer y={1} />

          {filterType === "date" && (
            <>
              <Row>
                <Text>
                  {"The dashboard date filter will overwrite the global date settings in the selected charts as well as the "}
                  <code>{"{{start_date}}"}</code>
                  {" and "}
                  <code>{"{{end_date}}"}</code>
                  {" variables in the queries."}
                </Text>
              </Row>
              <Spacer y={2} />
              <Row wrap="wrap">
                <LinkNext onPress={() => _onSelectRange("this_month")} className="mb-5">
                  <Chip color="primary" size="sm" variant={"bordered"}>
                    This month
                  </Chip>
                </LinkNext>
                <Spacer x={0.5} />
                <LinkNext onPress={() => _onSelectRange("last_7_days")} className="mb-5">
                  <Chip color="primary" size="sm" variant={"bordered"}>
                    Last 7 days
                  </Chip>
                </LinkNext>
                <Spacer x={0.5} />
                <LinkNext onPress={() => _onSelectRange("last_30_days")} className="mb-5">
                  <Chip color="primary" size="sm" variant={"bordered"}>
                    Last 30 days
                  </Chip>
                </LinkNext>
                <Spacer x={0.5} />
                <LinkNext onPress={() => _onSelectRange("last_90_days")} className="mb-5">
                  <Chip color="primary" size="sm" variant={"bordered"}>
                    Last 90 days
                  </Chip>
                </LinkNext>
                <Spacer x={0.5} />
                <LinkNext onPress={() => _onSelectRange("last_year")} className="mb-5">
                  <Chip color="primary" size="sm" variant={"bordered"}>
                    Last year
                  </Chip>
                </LinkNext>
                <Spacer x={0.5} />
                <LinkNext onPress={() => _onSelectRange("quarter_to_date")} className="mb-5">
                  <Chip color="primary" size="sm" variant={"bordered"}>
                    Quarter to date
                  </Chip>
                </LinkNext>
                <Spacer x={0.5} />
                <LinkNext onPress={() => _onSelectRange("last_quarter")} className="mb-5">
                  <Chip color="primary" size="sm" variant={"bordered"}>
                    Last quarter
                  </Chip>
                </LinkNext>
                <Spacer x={0.5} />
                <LinkNext onPress={() => _onSelectRange("year_to_date")} className="mb-5">
                  <Chip color="primary" size="sm" variant={"bordered"}>
                    Year to date
                  </Chip>
                </LinkNext>
              </Row>
              <Spacer y={2} />
              <Row align="center">
                <Popover className={"z-[99999]"}>
                  <PopoverTrigger>
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                      <Input
                        placeholder="Start date"
                        label="Start date"
                        value={dateRange.startDate && moment(dateRange.startDate).format("Do MMM YYYY")}
                        readOnly
                        variant="bordered"
                      />
                      <Spacer x={1} />
                      <Input
                        placeholder="End date"
                        label="End date"
                        value={dateRange.endDate && moment(dateRange.endDate).format("Do MMM YYYY")}
                        readOnly
                        variant="bordered"
                      />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent>
                    <DateRange
                      direction="horizontal"
                      rangeColors={[secondary, primary]}
                      ranges={[
                        dateRange.startDate && dateRange.endDate ? {
                          startDate: new Date(dateRange.startDate),
                          endDate: new Date(dateRange.endDate),
                          key: "selection",
                        } : initSelectionRange
                      ]}
                      onChange={_onChangeDateRange}
                      months={2}
                      showPreview={false}
                      showDateDisplay={false}
                    />
                  </PopoverContent>
                </Popover>
              </Row>
              <Spacer y={2} />
              <Row>
                <Text>
                  Select the charts that will be affected by the date filter
                </Text>
              </Row>
              <Spacer y={1} />
              <Row wrap="wrap">
                {charts.map((chart) => (
                  <Fragment key={chart.id}>
                    <LinkNext onPress={() => onEditFilterGroup(chart.id)} css={{ pb: 5 }}>
                      <Chip
                        color="primary"
                        radius="sm"
                        variant={filterGroups.find(c => c === chart.id) ? "default" : "bordered"}
                      >
                        {chart.name}
                      </Chip>
                    </LinkNext>
                    <Spacer x={0.6} />
                  </Fragment>
                ))}
              </Row>
            </>
          )}

          {filterType === "custom" && (
            <>
              <Row align="center">
                <Dropdown>
                  <DropdownTrigger>
                    <Button
                      variant="flat"
                      color="default"
                    >
                      {(filter.field && filter.field.substring(filter.field.lastIndexOf(".") + 1)) || "Select a field"}
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    variant="bordered"
                    selectedKeys={[filter.field]}
                    onSelectionChange={(selection) => _updateFilter(Object.values(selection)[0], "field")}
                    selectionMode="single"
                    className="min-w-max"
                  >
                    {fieldOptions.map((field) => (
                      <DropdownItem key={field.value}>
                        <LinkNext className="flex align-middle text-default">
                          <Chip size="sm" color={field.label.color} className="min-w-[70px]">
                            {field.type}
                          </Chip>
                          <Spacer x={0.5} />
                          <Text>
                            {field.text}
                          </Text>
                        </LinkNext>
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </Dropdown>
                <Spacer x={0.5} />
                <Dropdown>
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
                    variant="bordered"
                    selectionMode="single"
                    selectedKeys={[filter.operator]}
                    onSelectionChange={(selection) => _updateFilter(Object.values(selection)[0], "operator")}
                  >
                    {operators.map((op) => (
                      <DropdownItem key={op.value}>
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
                      placeholder="Enter a value"
                      value={filter.value}
                      onChange={(e) => _updateFilter(e.target.value, "value")}
                    />
                )}
                {_.find(fieldOptions, { value: filter.field })
                  && _.find(fieldOptions, { value: filter.field }).type === "date" && (
                    <Popover placement="bottom">
                      <PopoverTrigger>
                        <Input
                          placeholder="Click to open calendar"
                          startContent={<CalendarIcon />}
                          value={(filter.value && format(new Date(filter.value), "Pp", { locale: enGB })) || ""}
                        />
                      </PopoverTrigger>
                      <PopoverContent>
                        <Calendar
                          date={(filter.value && new Date(filter.value)) || new Date()}
                          onChange={(date) => _updateFilter(formatISO(date), "value")}
                          locale={enGB}
                          color={secondary}
                        />
                      </PopoverContent>
                    </Popover>
                )}
                <Spacer x={0.5} />
                <Tooltip content={"If you can't see your fields, please go in each chart and re-run the queries. Chartbrew will then index the fields and then they will appear here."} css={{ zIndex: 99999 }}>
                  <LinkNext className="text-primary-400">
                    <InfoCircle />
                  </LinkNext>
                </Tooltip>
              </Row>
              <Spacer y={2} />
              {filter.field && (
                <>
                  <Row align="center">
                    <Text b>The filter will affect the following charts:</Text>
                  </Row>
                  <Spacer y={1} />
                  <Row wrap="wrap">
                    {_getChartsWithField(filter.field).map((chart) => (
                      <>
                        <Chip color="primary" key={chart.id} radius="sm">
                          {chart.name}
                        </Chip>
                        <Spacer x={0.3} />
                      </>
                    ))}
                  </Row>
                </>
              )}
              <Spacer y={2} />
              <Row>
                <Button
                  endContent={<Plus />}
                  disabled={!filter.value}
                  onClick={_onAddFilter}
                  auto
                >
                  Apply filter
                </Button>
              </Row>
            </>
          )}
        </Container>
      </ModalBody>
      <ModalFooter>
        <Button auto onClick={onClose} color="warning" variant="flat">
          Close
        </Button>
        <Button auto onClick={_onApplyFilter}>
          Apply filter
        </Button>
      </ModalFooter>
    </Modal>
  );
}

Filters.propTypes = {
  charts: PropTypes.array.isRequired,
  projectId: PropTypes.number.isRequired,
  onAddFilter: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.bool.isRequired,
  filterGroups: PropTypes.array.isRequired,
  onEditFilterGroup: PropTypes.func.isRequired,
};

export default Filters;
