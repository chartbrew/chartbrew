import React, { useState } from "react";
import PropTypes from "prop-types";
import _ from "lodash";
import {
  Button, Checkbox, Container, Divider, Grid, Loading, Row, Spacer, Text, Tooltip,
  Link as LinkNext,
} from "@nextui-org/react";
import {
  CloseSquare, Download, Hide, Show, TickSquare
} from "react-iconly";

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
    <Container>
      <Row>
        <Text b>
          Select which charts you want to export
        </Text>
      </Row>
      <Spacer y={1} />
      <Row align="center">
        <Button
          bordered
          onClick={_onSelectAll}
          iconRight={<TickSquare />}
          auto
          size="sm"
        >
          Select all
        </Button>
        <Spacer x={0.2} />
        <Button
          bordered
          onClick={_onDeselectAll}
          size="sm"
          iconRight={<CloseSquare />}
          auto
        >
          Deselect all
        </Button>
      </Row>
      <Spacer y={0.5} />
      <Row align="center">
        <Grid.Container gap={2}>
          {charts && charts.filter((c) => !c.disabledExport).map((chart) => {
            return (
              <Grid key={chart.id} xs={12} sm={6}>
                <div style={{ flex: 1, alignItems: "center" }}>
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
                      <Spacer x={0.2} />
                      <Tooltip content="Disable the export function for this chart" css={{ zIndex: 999999 }}>
                        <LinkNext css={{ color: "$warning" }} onClick={() => onUpdate(chart.id, true)}>
                          <Show />
                        </LinkNext>
                      </Tooltip>
                    </>
                    )}
                  </Row>
                </div>
              </Grid>
            );
          })}
        </Grid.Container>
      </Row>
      <Spacer y={0.5} />

      {showDisabled && (
        <>
          <Divider />
          <Spacer y={1} />
          {charts && charts.filter((c) => c.disabledExport).length > 0 && (
            <Row>
              <Text b>
                Admin view - Charts disabled for export
              </Text>
            </Row>
          )}
          <Row align="center">
            <Grid.Container gap={2}>
              {charts && charts.filter((c) => c.disabledExport).map((chart) => {
                return (
                  <Grid key={chart.id} xs={12} sm={6}>
                    <Tooltip content="Enable the export function for this chart" css={{ zIndex: 99999 }}>
                      <LinkNext css={{ color: "$success", ai: "center" }} onClick={() => onUpdate(chart.id, false)}>
                        <Hide />
                        {chart.name}
                      </LinkNext>
                    </Tooltip>
                  </Grid>
                );
              })}
            </Grid.Container>
          </Row>
          <Spacer y={1} />
        </>
      )}
      <Row align="center">
        <Button
          onClick={() => onExport(selectedIds)}
          iconRight={<Download />}
          disabled={loading}
          auto
        >
          {loading && <Loading type="points" />}
          {!loading && "Export"}
        </Button>
      </Row>
      <Spacer y={0.5} />
      {error && (
        <Row>
          <Text css={{ color: "$error" }} i>{"One or more of the charts failed to export. Check that all your requests are still running correctly before exporting."}</Text>
        </Row>
      )}
    </Container>
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
