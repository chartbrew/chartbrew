import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Accordion,
  Button,
  Checkbox,
  Label,
} from "@heroui/react";
import { LuCheckCheck } from "react-icons/lu";
import DateRangeFilter from "./DateRangeFilter";
import {
  resolveDateFilterChartSelection,
  serializeDateFilterChartSelection,
} from "../../../modules/dashboardFilters";

function EditDateRangeFilter({
  charts,
  filter,
  onChange,
}) {
  const eligibleCharts = useMemo(() => charts.filter((chart) => chart.type !== "markdown"), [charts]);
  const eligibleChartIds = useMemo(() => eligibleCharts.map((chart) => chart.id), [eligibleCharts]);
  const [selectedCharts, setSelectedCharts] = useState(() => (
    resolveDateFilterChartSelection(eligibleChartIds, filter?.charts)
  ));
  const [dateRange, setDateRange] = useState({
    startDate: filter?.startDate,
    endDate: filter?.endDate,
  });

  useEffect(() => {
    setSelectedCharts(resolveDateFilterChartSelection(eligibleChartIds, filter?.charts));
    setDateRange({
      startDate: filter?.startDate,
      endDate: filter?.endDate,
    });
  }, [eligibleChartIds, filter]);

  const _handleChartSelection = (chartId, selectAll = false) => {
    let newSelectedCharts;

    if (selectAll) {
      newSelectedCharts = eligibleChartIds;
    } else {
      newSelectedCharts = selectedCharts.includes(chartId)
        ? selectedCharts.filter(id => id !== chartId)
        : [...selectedCharts, chartId];
    }

    if (newSelectedCharts.length === 0) return;

    setSelectedCharts(newSelectedCharts);
    onChange({
      ...filter,
      charts: serializeDateFilterChartSelection(eligibleChartIds, newSelectedCharts),
    });
  };

  const _handleDateRangeChange = (newDateRange) => {
    setDateRange(newDateRange);
    onChange({ ...filter, ...newDateRange });
  };

  const selectionSummary = eligibleCharts.length === 0
    ? "No compatible charts"
    : selectedCharts.length === eligibleCharts.length
      ? `All ${eligibleCharts.length} chart${eligibleCharts.length === 1 ? "" : "s"}`
      : `${selectedCharts.length} of ${eligibleCharts.length} charts`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DateRangeFilter
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          onChange={_handleDateRangeChange}
          size="lg"
          isEdit
        />
      </div>
      <div className="flex flex-row">
        <span className="text-sm text-default-600">
          {"This range narrows the selected charts' date window and supplies the "}
          <code className="rounded-md bg-default/40 px-1.5 py-0.5 text-xs text-default-700">{"{{start_date}}"}</code>
          {" and "}
          <code className="rounded-md bg-default/40 px-1.5 py-0.5 text-xs text-default-700">{"{{end_date}}"}</code>
          {" variables in the queries."}
        </span>
      </div>

      <Accordion variant="surface" className="bg-surface-secondary">
        <Accordion.Item id="date-filter-charts" textValue="Affected charts">
          <Accordion.Heading>
            <Accordion.Trigger>
              <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                <span className="text-sm font-medium">Affected charts</span>
                <span className="text-xs text-default-500">{selectionSummary}</span>
              </div>
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="flex flex-col gap-4">
              <p className="text-sm text-default-600">
                All charts are included by default. Adjust this only when the date range should target specific charts.
              </p>

              {eligibleCharts.length > 0 && (
                <>
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      isDisabled={selectedCharts.length === eligibleCharts.length}
                      onPress={() => _handleChartSelection(null, true)}
                    >
                      <LuCheckCheck />
                      Select all
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {eligibleCharts.map((chart) => {
                      const isSelected = selectedCharts.includes(chart.id);
                      return (
                        <Checkbox
                          id={`date-filter-chart-${chart.id}`}
                          key={chart.id}
                          isSelected={isSelected}
                          isDisabled={isSelected && selectedCharts.length === 1}
                          onChange={() => _handleChartSelection(chart.id)}
                        >
                          <Checkbox.Control className="size-4 shrink-0">
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          <Checkbox.Content>
                            <Label htmlFor={`date-filter-chart-${chart.id}`} className="text-sm">
                              {chart.name}
                            </Label>
                          </Checkbox.Content>
                        </Checkbox>
                      );
                    })}
                  </div>
                </>
              )}
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </div>
  );
}

EditDateRangeFilter.propTypes = {
  charts: PropTypes.array.isRequired,
  filter: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default EditDateRangeFilter;
