import React, { useState } from "react";
import PropTypes from "prop-types";
import _ from "lodash";
import {
  Button, Checkbox, Separator, Tooltip, Link as LinkNext,
} from "@heroui/react";
import { LuCheckCheck, LuEye, LuEyeOff, LuFileDown, LuX } from "react-icons/lu";

function ChartExport(props) {
  const {
    charts, onExport, onUpdate, loading, error, showDisabled,
  } = props;
  const [selectedIds, setSelectedIds] = useState([]);

  const _onSelectChart = (id) => {
    const foundIndex = _.indexOf(selectedIds, id);
    const newSelectedIds = _.clone(selectedIds);

    if (foundIndex > -1) {
      newSelectedIds.splice(foundIndex, 1);
    } else {
      newSelectedIds.push(id);
    }

    setSelectedIds(newSelectedIds);
  };

  const _onSelectAll = () => {
    const ids = [];
    charts.forEach((chart) => {
      if (chart.disabledExport) return;
      ids.push(chart.id);
    });
    setSelectedIds(ids);
  };

  const _onDeselectAll = () => {
    setSelectedIds([]);
  };

  return (
    <div>
      <div>
        Select which charts you want to export
      </div>
      <div className="h-4" />
      <div className="flex flex-row flex-wrap gap-2">
        <Button
          variant="ghost"
          onPress={_onSelectAll}
          endContent={<LuCheckCheck />}
          size="sm"
        >
          Select all
        </Button>
        <Button
          variant="ghost"
          onPress={_onDeselectAll}
          size="sm"
          endContent={<LuX />}
        >
          Deselect all
        </Button>
      </div>
      <div className="h-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {charts && charts.filter((c) => !c.disabledExport).map((chart) => {
          return (
            <div key={chart.id}>
              <div className="flex items-center align-middle">
                <div className="flex flex-row flex-wrap gap-2">
                  <Checkbox
                    isSelected={_.indexOf(selectedIds, chart.id) > -1}
                    onChange={() => _onSelectChart(chart.id)}
                    size="sm"
                  >
                    {chart.name}
                  </Checkbox>
                  {showDisabled && (
                    <Tooltip>
                      <Tooltip.Trigger>
                        <LinkNext className={"text-warning"} onClick={() => onUpdate(chart.id, true)}>
                          <LuEye className="text-warning" />
                        </LinkNext>
                      </Tooltip.Trigger>
                      <Tooltip.Content className="z-[999999]">
                        Disable the export function for this chart
                      </Tooltip.Content>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="h-4" />

      {showDisabled && (
        <>
          <Separator />
          <div className="h-8" />
          {charts && charts.filter((c) => c.disabledExport).length > 0 && (
            <div>
              Charts disabled for export
            </div>
          )}
          <div className="h-4" />
          <div className="flex flex-row flex-wrap gap-2">
            {charts && charts.filter((c) => c.disabledExport).map((chart) => {
              return (
                <div key={chart.id}>
                  <Tooltip>
                    <Tooltip.Trigger>
                      <LinkNext className="text-sm cursor-pointer" onClick={() => onUpdate(chart.id, false)}>
                        <LuEyeOff className="mr-1" size={16} />
                        {chart.name}
                      </LinkNext>
                    </Tooltip.Trigger>
                    <Tooltip.Content className="z-[99999]">
                      Enable the export function for this chart
                    </Tooltip.Content>
                  </Tooltip>
                </div>
              );
            })}
          </div>
          <div className="h-4" />
        </>
      )}
      <div className="h-8" />
      <div>
        <Button
          onPress={() => onExport(selectedIds)}
          endContent={<LuFileDown />}
          isLoading={loading}
          color="primary"
          fullWidth
        >
          {"Export"}
        </Button>
      </div>
      <div className="h-8" />
      {error && (
        <div color="text-danger italic">{"One or more of the charts failed to export. Check that all your requests are still running correctly before exporting."}</div>
      )}
    </div>
  );
}

ChartExport.defaultProps = {
  loading: false,
  error: false,
  showDisabled: false,
};

ChartExport.propTypes = {
  charts: PropTypes.array.isRequired,
  onExport: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.bool,
  showDisabled: PropTypes.bool,
};

export default ChartExport;
