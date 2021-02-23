import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Container, Divider, Grid, Header
} from "semantic-ui-react";
import _ from "lodash";

function ChartExport(props) {
  const {
    charts, onExport, loading, error
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
    charts.map((chart) => {
      ids.push(chart.id);
      return chart;
    });
    setSelectedIds(ids);
  };

  const _onDeselectAll = () => {
    setSelectedIds([]);
  };

  return (
    <Container>
      <Header size="small">
        Select which charts you want to export
      </Header>
      <Button
        content="Select all"
        onClick={_onSelectAll}
        size="tiny"
        labelPosition="left"
        icon="check"
      />
      <Button
        content="Deselect all"
        onClick={_onDeselectAll}
        size="tiny"
        labelPosition="right"
        icon="x"
      />
      <Divider hidden />
      <Grid columns={2}>
        {charts && charts.map((chart) => {
          return (
            <Grid.Column key={chart.id}>
              <Checkbox
                checked={_.indexOf(selectedIds, chart.id) > -1}
                onChange={() => _onSelectChart(chart.id)}
                label={chart.name}
              />
            </Grid.Column>
          );
        })}
      </Grid>
      <Divider />
      <Button
        primary
        onClick={() => onExport(selectedIds)}
        content="Export"
        labelPosition="right"
        icon="file excel"
        loading={loading}
      />
      {error && (
        <p style={{ color: "red" }}><i>{"One or more of the charts failed to export. Check that all your requests are still running correctly before exporting."}</i></p>
      )}
    </Container>
  );
}

ChartExport.defaultProps = {
  loading: false,
  error: false,
};

ChartExport.propTypes = {
  charts: PropTypes.array.isRequired,
  onExport: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.bool,
};

export default ChartExport;
