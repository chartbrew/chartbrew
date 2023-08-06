import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import moment from "moment";
import _ from "lodash";
import uuid from "uuid/v4";
import { formatISO, format } from "date-fns";
import { Calendar, DateRange } from "react-date-range";
import { enGB } from "date-fns/locale";
import {
  Container, Dropdown, Row, Spacer, Text, Link as LinkNext, Input, Popover,
  Tooltip, Button, Modal, Badge, Divider,
} from "@nextui-org/react";
import { Calendar as CalendarIcon, InfoCircle, Plus } from "react-iconly";

import { operators } from "../../../modules/filterOperations";
import { primary, secondary } from "../../../config/colors";

function Filters(props) {
  const {
    charts, projectId, onAddFilter, open, onClose
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
    startDate: moment().startOf("month").toDate(),
    endDate: moment().endOf("month").toDate(),
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
    if (type === "last_7_days") {
      setDateRange({
        startDate: moment().subtract(7, "days").startOf("day").toDate(),
        endDate: moment().endOf("day").toDate(),
        key: "selection",
      });
    }

    if (type === "last_30_days") {
      setDateRange({
        startDate: moment().subtract(30, "days").startOf("day").toDate(),
        endDate: moment().endOf("day").toDate(),
        key: "selection",
      });
    }

    if (type === "last_90_days") {
      setDateRange({
        startDate: moment().subtract(90, "days").startOf("day").toDate(),
        endDate: moment().endOf("day").toDate(),
        key: "selection",
      });
    }

    if (type === "last_year") {
      setDateRange({
        startDate: moment().subtract(1, "year").startOf("day").toDate(),
        endDate: moment().endOf("day").toDate(),
        key: "selection",
      });
    }

    if (type === "quarter_to_date") {
      setDateRange({
        startDate: moment().startOf("quarter").startOf("day").toDate(),
        endDate: moment().endOf("day").toDate(),
        key: "selection",
      });
    }

    if (type === "last_quarter") {
      setDateRange({
        startDate: moment().subtract(1, "quarter").startOf("quarter").startOf("day")
          .toDate(),
        endDate: moment().subtract(1, "quarter").endOf("quarter").endOf("day")
          .toDate(),
        key: "selection",
      });
    }

    if (type === "year_to_date") {
      setDateRange({
        startDate: moment().startOf("year").startOf("day").toDate(),
        endDate: moment().endOf("day").toDate(),
        key: "selection",
      });
    }
  };

  const _onChangeDateRange = (ranges) => {
    setDateRange(ranges.selection);
  };

  const _onApplyFilter = () => {
    if (filterType === "date") {
      //
    } else {
      _onAddFilter();
    }
  };

  return (
    <Modal open={open} onClose={onClose} closeButton width="800px">
      <Modal.Header>
        <Text h3>Dashboard filters</Text>
      </Modal.Header>
      <Modal.Body>
        <Container>
          <Row>
            <LinkNext
              css={{
                background: filterType === "date" ? "$blue100" : "$backgroundContrast",
                p: 5,
                pr: 10,
                pl: 10,
                br: "$sm",
                "@xsMax": { width: "90%" },
                ai: "center",
                color: "$text",
              }}
              onPress={() => setFilterType("date")}
            >
              Date filters
            </LinkNext>
            <Spacer x={0.5} />
            <LinkNext
              css={{
                background: filterType === "custom" ? "$blue100" : "$backgroundContrast",
                p: 5,
                pr: 10,
                pl: 10,
                br: "$sm",
                "@xsMax": { width: "90%" },
                ai: "center",
                color: "$text",
              }}
              onPress={() => setFilterType("custom")}
            >
              Field-based filters
            </LinkNext>
          </Row>
          <Spacer y={0.5} />
          <Divider />
          <Spacer y={0.3} />
          <Spacer y={1} />

          {filterType === "date" && (
            <>
              <Row wrap="wrap">
                <LinkNext onPress={() => _onSelectRange("last_7_days")}>
                  <Badge color="primary" size="sm" variant={"bordered"}>
                    Last 7 days
                  </Badge>
                </LinkNext>
                <Spacer x={0.2} />
                <LinkNext onPress={() => _onSelectRange("last_30_days")}>
                  <Badge color="primary" size="sm" variant={"bordered"}>
                    Last 30 days
                  </Badge>
                </LinkNext>
                <Spacer x={0.2} />
                <LinkNext onPress={() => _onSelectRange("last_90_days")}>
                  <Badge color="primary" size="sm" variant={"bordered"}>
                    Last 90 days
                  </Badge>
                </LinkNext>
                <Spacer x={0.2} />
                <LinkNext onPress={() => _onSelectRange("last_year")}>
                  <Badge color="primary" size="sm" variant={"bordered"}>
                    Last year
                  </Badge>
                </LinkNext>
                <Spacer x={0.2} />
                <LinkNext onPress={() => _onSelectRange("quarter_to_date")}>
                  <Badge color="primary" size="sm" variant={"bordered"}>
                    Quarter to date
                  </Badge>
                </LinkNext>
                <Spacer x={0.2} />
                <LinkNext onPress={() => _onSelectRange("last_quarter")}>
                  <Badge color="primary" size="sm" variant={"bordered"}>
                    Last quarter
                  </Badge>
                </LinkNext>
                <Spacer x={0.2} />
                <LinkNext onPress={() => _onSelectRange("year_to_date")}>
                  <Badge color="primary" size="sm" variant={"bordered"}>
                    Year to date
                  </Badge>
                </LinkNext>
              </Row>
              <Spacer y={1} />
              <Row align="center">
                <Popover css={{ zIndex: 99999 }}>
                  <Popover.Trigger>
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                      <Input
                        placeholder="Start date"
                        label="Start date"
                        value={dateRange.startDate && format(new Date(dateRange.startDate), "Pp", { locale: enGB })}
                        readOnly
                        bordered
                      />
                      <Spacer x={0.5} />
                      <Input
                        placeholder="End date"
                        label="End date"
                        value={dateRange.endDate && format(new Date(dateRange.endDate), "Pp", { locale: enGB })}
                        readOnly
                        bordered
                      />
                    </div>
                  </Popover.Trigger>
                  <Popover.Content>
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
                  </Popover.Content>
                </Popover>
              </Row>
              <Spacer y={1} />
            </>
          )}

          {filterType === "custom" && (
            <>
              <Row align="center">
                <Dropdown isBordered>
                  <Dropdown.Button flat>
                    {(filter.field && filter.field.substring(filter.field.lastIndexOf(".") + 1)) || "Select a field"}
                  </Dropdown.Button>
                  <Dropdown.Menu
                    selectedKeys={[filter.field]}
                    onSelectionChange={(selection) => _updateFilter(Object.values(selection)[0], "field")}
                    selectionMode="single"
                    css={{ maxWidth: "max-content" }}
                  >
                    {fieldOptions.map((field) => (
                      <Dropdown.Item key={field.value}>
                        <LinkNext css={{ ai: "center", color: "$text" }}>
                          <Badge size="sm" color={field.label.color} css={{ minWidth: 70 }}>
                            {field.type}
                          </Badge>
                          <Spacer x={0.2} />
                          <Text>
                            {field.text}
                          </Text>
                        </LinkNext>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
                <Spacer x={0.2} />
                <Dropdown isBordered>
                  <Dropdown.Button flat>
                    {(_.find(operators, { value: filter.operator })
                      && _.find(operators, { value: filter.operator }).key)
                      || "="}
                  </Dropdown.Button>
                  <Dropdown.Menu
                    selectionMode="single"
                    selectedKeys={[filter.operator]}
                    onSelectionChange={(selection) => _updateFilter(Object.values(selection)[0], "operator")}
                  >
                    {operators.map((op) => (
                      <Dropdown.Item key={op.value}>
                        {op.text}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
                <Spacer x={0.2} />
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
                      <Popover.Trigger>
                        <Input
                          placeholder="Click to open calendar"
                          contentLeft={<CalendarIcon />}
                          value={(filter.value && format(new Date(filter.value), "Pp", { locale: enGB })) || ""}
                        />
                      </Popover.Trigger>
                      <Popover.Content>
                        <Calendar
                          date={(filter.value && new Date(filter.value)) || new Date()}
                          onChange={(date) => _updateFilter(formatISO(date), "value")}
                          locale={enGB}
                          color={secondary}
                        />
                      </Popover.Content>
                    </Popover>
                )}
                <Spacer x={0.2} />
                <Tooltip content={"If you can't see your fields, please go in each chart and re-run the queries. Chartbrew will then index the fields and then they will appear here."} css={{ zIndex: 99999 }}>
                  <LinkNext css={{ color: "$blue400" }}>
                    <InfoCircle />
                  </LinkNext>
                </Tooltip>
              </Row>
              <Spacer y={1} />
              {filter.field && (
                <>
                  <Row align="center">
                    <Text b>The filter will affect the following charts:</Text>
                  </Row>
                  <Spacer y={0.5} />
                  <Row wrap="wrap">
                    {_getChartsWithField(filter.field).map((chart) => (
                      <>
                        <Badge color="primary" key={chart.id} isSquared>
                          {chart.name}
                        </Badge>
                        <Spacer x={0.1} />
                      </>
                    ))}
                  </Row>
                </>
              )}
              <Spacer y={1} />
              <Row>
                <Button
                  iconRight={<Plus />}
                  content="Apply filter"
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
      </Modal.Body>
      <Modal.Footer>
        <Button auto onClick={onClose} color="warning" flat>
          Close
        </Button>
        <Button auto onClick={_onApplyFilter}>
          Apply filter
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

Filters.propTypes = {
  charts: PropTypes.array.isRequired,
  projectId: PropTypes.number.isRequired,
  onAddFilter: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.bool.isRequired,
};

export default Filters;
