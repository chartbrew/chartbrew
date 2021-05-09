import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import _ from "lodash";
import uuid from "uuid/v4";
import {
  Button, Container, Divider, Dropdown, Grid, Header, Icon, Input, Label, Popup,
} from "semantic-ui-react";
import { formatISO, format } from "date-fns";
import { Calendar } from "react-date-range";
import { enGB } from "date-fns/locale";

import { operators } from "../../../modules/filterOperations";
import { secondary } from "../../../config/colors";

function Filters(props) {
  const { charts, projectId, onAddFilter } = props;

  const [fieldOptions, setFieldOptions] = useState([]);
  const [filter, setFilter] = useState({
    id: uuid(),
    field: "",
    operator: "is",
    value: "",
    projectId,
  });

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
    if (!filter.value) return;
    onAddFilter(filter);
    setFilter({
      id: uuid(),
      field: "",
      operator: "is",
      value: "",
      projectId,
    });
  };

  return (
    <Container>
      <Grid columns={1} relaxed>
        <Grid.Column>
          <Header as="h4">
            Configure your filter
          </Header>
          <div>
            <Dropdown
              icon={null}
              header="Type to search"
              className="button"
              button
              options={fieldOptions}
              search
              text={(filter.field && filter.field.substring(filter.field.lastIndexOf(".") + 1)) || "field"}
              value={filter.field}
              onChange={(e, data) => _updateFilter(data.value, "field")}
            />
            <Dropdown
              icon={null}
              button
              className="button"
              options={operators}
              search
              text={
                (
                  _.find(operators, { value: filter.operator })
                  && _.find(operators, { value: filter.operator }).key
                )
                || "="
              }
              value={filter.operator}
              onChange={(e, data) => _updateFilter(data.value, "operator")}
            />

            {(!filter.field
              || (_.find(fieldOptions, { value: filter.field })
                && _.find(fieldOptions, { value: filter.field }).type !== "date")) && (
                <Input
                  placeholder="Enter a value"
                  value={filter.value}
                  onChange={(e, data) => _updateFilter(data.value, "value")}
                />
            )}
            {_.find(fieldOptions, { value: filter.field })
              && _.find(fieldOptions, { value: filter.field }).type === "date" && (
                <Popup
                  on="click"
                  position="bottom center"
                  trigger={(
                    <Input
                      placeholder="Enter a value"
                      icon="calendar alternate"
                      iconPosition="left"
                      value={filter.value && format(new Date(filter.value), "Pp", { locale: enGB })}
                    />
                  )}
                  content={(
                    <Calendar
                      date={(filter.value && new Date(filter.value)) || new Date()}
                      onChange={(date) => _updateFilter(formatISO(date), "value")}
                      locale={enGB}
                      color={secondary}
                    />
                  )}
                />
            )}
            <Popup
              trigger={<Icon style={{ marginLeft: 15 }} size="large" name="question circle outline" />}
              content={
                "If you can't see your fields, please go in each chart and re-run the queries. Chartbrew will then index the fields and then they will appear here."
              }
            />
          </div>
        </Grid.Column>

        {filter.field && (
          <Grid.Column>
            <Divider />
            <Header as="h4">The filter will affect the following charts:</Header>
            <Label.Group>
              {_getChartsWithField(filter.field).map((chart) => (
                <Label key={chart.id}>
                  {chart.name}
                </Label>
              ))}
            </Label.Group>
          </Grid.Column>
        )}

        <Grid.Column>
          <Button
            primary
            icon="plus"
            labelPosition="right"
            content="Apply filter"
            disabled={!filter.value}
            onClick={_onAddFilter}
          />
        </Grid.Column>
      </Grid>
    </Container>
  );
}

Filters.propTypes = {
  charts: PropTypes.array.isRequired,
  projectId: PropTypes.number.isRequired,
  onAddFilter: PropTypes.func.isRequired,
};

export default Filters;
