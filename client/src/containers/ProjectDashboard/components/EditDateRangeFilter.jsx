import React, { useState, Fragment, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button,
  Chip,
  Link as LinkNext,
} from "@heroui/react";
import { LuSquareCheck, LuX } from "react-icons/lu";
import DateRangeFilter from "./DateRangeFilter";

function EditDateRangeFilter({
  charts,
  filter,
  onChange,
}) {
  const [selectedCharts, setSelectedCharts] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: filter?.startDate,
    endDate: filter?.endDate,
  });

  useEffect(() => {
    setSelectedCharts(filter?.charts || []);
    setDateRange({
      startDate: filter?.startDate,
      endDate: filter?.endDate,
    });
  }, [filter]);

  const _handleChartSelection = (chartId, selectAll = false, deselectAll = false) => {
    let newSelectedCharts;
    
    if (selectAll) {
      newSelectedCharts = charts.filter(c => c.type !== "markdown").map(c => c.id);
    } else if (deselectAll) {
      newSelectedCharts = [];
    } else {
      newSelectedCharts = selectedCharts.includes(chartId)
        ? selectedCharts.filter(id => id !== chartId)
        : [...selectedCharts, chartId];
    }

    setSelectedCharts(newSelectedCharts);
    onChange({ ...filter, charts: newSelectedCharts });
  };

  const _handleDateRangeChange = (newDateRange) => {
    setDateRange(newDateRange);
    onChange({ ...filter, ...newDateRange });
  };

  return (
    <>
      <div className="font-bold">
        Configure the date filter
      </div>

      <div className="text-sm">
        Select the charts that will be affected by the date filter
      </div>
      <div className="flex flex-row flex-wrap gap-1">
        <Button
          variant="flat"
          startContent={<LuSquareCheck />}
          size="sm"
          onPress={() => _handleChartSelection(null, true)}
        >
          Select all
        </Button>
        <Button
          variant="flat"
          startContent={<LuX />}
          size="sm"
          onPress={() => _handleChartSelection(null, false, true)}
        >
          Deselect all
        </Button>
      </div>
      <div className="flex flex-row flex-wrap gap-1">
        {charts.filter(c => c.type !== "markdown").map((chart) => (
          <Fragment key={chart.id}>
            <LinkNext onPress={() => _handleChartSelection(chart.id)}>
              <Chip
                className="rounded-sm cursor-pointer"
                color={selectedCharts.includes(chart.id) ? "primary" : "default"}
                variant={selectedCharts.includes(chart.id) ? "solid" : "flat"}
              >
                {chart.name}
              </Chip>
            </LinkNext>
          </Fragment>
        ))}
      </div>
      <div>
        <DateRangeFilter
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          onChange={_handleDateRangeChange}
          showLabel
          size="lg"
          isEdit
        />
      </div>
      <div className="flex flex-row">
        <span className="text-sm">
          {"The dashboard date filter will overwrite the global date settings in the selected charts as well as the "}
          <code className="rounded-md bg-default/40 px-1.5 py-0.5 text-sm text-default-700">{"{{start_date}}"}</code>
          {" and "}
          <code className="rounded-md bg-default/40 px-1.5 py-0.5 text-sm text-default-700">{"{{end_date}}"}</code>
          {" variables in the queries."}
        </span>
      </div>
    </>
  );
}

EditDateRangeFilter.propTypes = {
  charts: PropTypes.array.isRequired,
  filter: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default EditDateRangeFilter;
