import React, { useState } from "react";
import PropTypes from "prop-types";
import _ from "lodash";
import {
  Button, Checkbox, Divider, Spacer, Tooltip, Link as LinkNext,
} from "@heroui/react";
import { LuCheckCheck, LuEye, LuEyeOff, LuFileDown, LuX } from "react-icons/lu";

import Row from "../../../components/Row";
import Text from "../../../components/Text";

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
      <Row>
        <Text b>
          Select which charts you want to export
        </Text>
      </Row>
      <Spacer y={2} />
      <Row align="center">
        <Button
          variant="ghost"
          onClick={_onSelectAll}
          endContent={<LuCheckCheck />}
          size="sm"
        >
          Select all
        </Button>
        <Spacer x={0.5} />
        <Button
          variant="ghost"
          onClick={_onDeselectAll}
          size="sm"
          endContent={<LuX />}
        >
          Deselect all
        </Button>
      </Row>
      <Spacer y={2} />
      <Row align="center">
        <div className="grid grid-cols-12 gap-2">
          {charts && charts.filter((c) => !c.disabledExport).map((chart) => {
            return (
              <div className="col-span-12 md:col-span-6" key={chart.id}>
                <div className="flex items-center align-middle">
                  <Row align="center">
                    <Checkbox
                      isSelected={_.indexOf(selectedIds, chart.id) > -1}
                      onChange={() => _onSelectChart(chart.id)}
                      size="sm"
                  >
                      {chart.name}
                    </Checkbox>
                    {showDisabled && (
                    <>
                      <Spacer x={0.5} />
                      <Tooltip content="Disable the export function for this chart" css={{ zIndex: 999999 }}>
                        <LinkNext className={"text-warning"} onClick={() => onUpdate(chart.id, true)}>
                          <LuEye />
                        </LinkNext>
                      </Tooltip>
                    </>
                    )}
                  </Row>
                </div>
              </div>
            );
          })}
        </div>
      </Row>
      <Spacer y={2} />

      {showDisabled && (
        <>
          <Divider />
          <Spacer y={4} />
          {charts && charts.filter((c) => c.disabledExport).length > 0 && (
            <Row>
              <Text b>
                Admin view - Charts disabled for export
              </Text>
            </Row>
          )}
          <Spacer y={2} />
          <Row align="center">
            <div className="grid grid-cols-12 gap-2">
              {charts && charts.filter((c) => c.disabledExport).map((chart) => {
                return (
                  <div className="col-span-6 sm:col-span-12" key={chart.id}>
                    <Tooltip content="Enable the export function for this chart" css={{ zIndex: 99999 }}>
                      <LinkNext className="text-success cursor-pointer" onClick={() => onUpdate(chart.id, false)}>
                        <LuEyeOff />
                        {chart.name}
                      </LinkNext>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          </Row>
          <Spacer y={2} />
        </>
      )}
      <Spacer y={4} />
      <Row align="center">
        <Button
          onClick={() => onExport(selectedIds)}
          endContent={<LuFileDown />}
          isLoading={loading}
          color="primary"
          fullWidth
        >
          {"Export"}
        </Button>
      </Row>
      <Spacer y={4} />
      {error && (
        <Row>
          <Text color="danger" i>{"One or more of the charts failed to export. Check that all your requests are still running correctly before exporting."}</Text>
        </Row>
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
